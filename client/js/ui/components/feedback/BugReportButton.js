/**
 * @fileoverview <bug-report-button> — floating bug-report trigger + inline modal.
 *
 * Fixed-position button (bottom-right) that opens a modal to submit bug reports.
 * Auto-captures canvas screenshot and diagnostics (console logs, network history,
 * game state, performance data) as attachments.
 *
 * Public API:
 *   open()  — capture screenshot + diagnostics, open the modal
 *   close() — dismiss the modal
 */

import { BaseComponent } from '../BaseComponent.js';
import { createSheet, overlayStyles } from '../shared-styles.js';
import { collectDiagnosticsBlob } from '../../../utils/DiagnosticCollector.js';
import { game } from '../../../main.js';

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5 MB per file
const MAX_ATTACHMENTS = 3;

const styles = createSheet(/* css */ `
  /* ─── Floating trigger button ─────────────────────────── */
  .bug-btn {
    position: fixed;
    bottom: 20px;
    left: 20px;
    z-index: 90;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 2px solid var(--color-secondary-neon);
    background: rgba(0, 0, 0, 0.75);
    color: var(--color-secondary-neon);
    font-size: 22px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow:
      0 0 8px rgba(255, 45, 236, 0.3),
      inset 0 0 6px rgba(255, 45, 236, 0.1);
    transition: all var(--transition-fast);
    animation: bugIdle 3s ease-in-out infinite;
  }
  .bug-btn:hover {
    transform: scale(1.12);
    box-shadow:
      0 0 16px rgba(255, 45, 236, 0.6),
      inset 0 0 10px rgba(255, 45, 236, 0.2);
  }
  .bug-btn.hidden { display: none; }

  @keyframes bugIdle {
    0%, 100% { box-shadow: 0 0 8px rgba(255, 45, 236, 0.3), inset 0 0 6px rgba(255, 45, 236, 0.1); }
    50%      { box-shadow: 0 0 14px rgba(255, 45, 236, 0.5), inset 0 0 10px rgba(255, 45, 236, 0.15); }
  }

  /* ─── Modal panel ─────────────────────────────────────── */
  .report-panel {
    background: var(--bg-secondary);
    border: 1px solid rgba(0, 255, 255, 0.2);
    border-radius: var(--radius-xl);
    padding: var(--spacing-xl) var(--spacing-xxl);
    width: min(420px, 92vw);
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: var(--shadow-glass);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }
  .report-panel h2 {
    font-size: 18px;
    margin-bottom: var(--spacing-xs);
  }

  /* ─── Form elements ───────────────────────────────────── */
  label {
    font-size: 13px;
    color: #aaa;
    display: block;
    margin-bottom: var(--spacing-xs);
  }
  textarea {
    width: 100%;
    min-height: 100px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(0, 255, 255, 0.15);
    border-radius: var(--radius-md);
    color: #fff;
    font-family: var(--font-primary);
    font-size: 13px;
    padding: var(--spacing-sm);
    resize: vertical;
    outline: none;
    transition: border-color var(--transition-fast);
  }
  textarea:focus {
    border-color: var(--color-primary-neon);
    box-shadow: 0 0 6px rgba(0, 255, 255, 0.2);
  }
  textarea::placeholder { color: #555; }

  .screenshot-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }
  .screenshot-thumb {
    width: 120px;
    height: 68px;
    object-fit: cover;
    border-radius: var(--radius-sm);
    border: 1px solid rgba(0, 255, 255, 0.2);
  }
  .screenshot-label {
    font-size: 11px;
    color: #777;
  }

  .file-input-wrap {
    position: relative;
  }
  .file-input-wrap input[type="file"] {
    display: none;
  }
  .file-pick-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: var(--spacing-xs) var(--spacing-md);
    font-size: 12px;
    font-family: var(--font-primary);
    color: var(--color-primary-neon);
    background: transparent;
    border: 1px solid rgba(0, 255, 255, 0.25);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .file-pick-btn:hover {
    background: rgba(0, 255, 255, 0.08);
    border-color: var(--color-primary-neon);
  }
  .file-list {
    font-size: 11px;
    color: #888;
    margin-top: var(--spacing-xs);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-sm);
  }

  /* ─── Feedback ────────────────────────────────────────── */
  .feedback {
    font-size: 12px;
    text-align: center;
    min-height: 18px;
  }
  .feedback.success { color: var(--color-accent-green); text-shadow: 0 0 4px var(--color-accent-green); }
  .feedback.error   { color: var(--color-accent-red); text-shadow: 0 0 4px var(--color-accent-red); }

  .info-note {
    font-size: 10px;
    color: #555;
    text-align: center;
    line-height: 1.4;
  }
`);

class BugReportButton extends BaseComponent {
  constructor() {
    super();

    /** @type {string|null} Base64 data URL of captured screenshot */
    this._screenshot = null;
    /** @type {File[]} Additional user-selected files */
    this._extraFiles = [];
    /** @type {Blob|null} Diagnostics JSON blob */
    this._diagnosticsBlob = null;

    this._render(/* html */ `
      <!-- Floating trigger -->
      <button class="bug-btn" id="trigger" title="Report a bug">🐛</button>

      <!-- Modal overlay -->
      <div class="overlay" id="modal">
        <div class="report-panel">
          <h2>🐛 Report a Bug</h2>

          <label for="desc">What happened?</label>
          <textarea id="desc" placeholder="Describe the bug, what you expected, and what actually happened…" maxlength="2000"></textarea>

          <div class="screenshot-row" id="screenshotRow" style="display:none">
            <img class="screenshot-thumb" id="thumb" alt="screenshot" />
            <span class="screenshot-label">Auto-captured screenshot</span>
          </div>

          <div class="file-input-wrap">
            <button class="file-pick-btn" id="pickBtn">📎 Attach files (optional)</button>
            <input type="file" id="fileInput" accept="image/*,.txt,.log,.json" multiple />
            <div class="file-list" id="fileList"></div>
          </div>

          <p class="info-note">Console logs, network history, and game state will be attached automatically.</p>

          <div class="feedback" id="feedback"></div>

          <div class="actions">
            <neon-button id="cancelBtn" variant="default">Cancel</neon-button>
            <neon-button id="submitBtn" variant="primary">Send Report</neon-button>
          </div>
        </div>
      </div>
    `, overlayStyles, styles);

    // ─── Bind events ───────────────────────────────────────

    this._$('#trigger').addEventListener('click', () => this.open());

    this._$('#cancelBtn').addEventListener('click', () => this.close());

    // Close on overlay backdrop click
    this._$('#modal').addEventListener('click', (e) => {
      if (e.target === this._$('#modal')) this.close();
    });

    this._$('#pickBtn').addEventListener('click', () => {
      this._$('#fileInput').click();
    });

    this._$('#fileInput').addEventListener('change', (e) => {
      const input = /** @type {HTMLInputElement} */ (e.target);
      this._extraFiles = Array.from(input.files || []).slice(0, MAX_ATTACHMENTS);
      this._renderFileList();
    });

    // Prevent global game hotkeys from hijacking text input (e.g. Space)
    this._$('#desc').addEventListener('keydown', (e) => {
      e.stopPropagation();
    });

    this._$('#submitBtn').addEventListener('click', () => this._submit());
  }

  // ─── Public API ────────────────────────────────────────

  /** Capture screenshot + diagnostics and open the report modal. */
  open() {
    if (game?.gameState === 'playing') {
      game.pause();
    }

    this._captureScreenshot();
    this._diagnosticsBlob = collectDiagnosticsBlob();
    this._extraFiles = [];
    /** @type {HTMLInputElement} */ (this._$('#fileInput')).value = '';
    this._renderFileList();
    /** @type {HTMLTextAreaElement} */ (this._$('#desc')).value = '';
    this._setFeedback('');
    this._$('#trigger').classList.add('hidden');

    const modal = this._$('#modal');
    modal.classList.add('show');
  }

  /** Close the report modal. */
  close() {
    const modal = this._$('#modal');
    modal.classList.remove('show');
    this._$('#trigger').classList.remove('hidden');
  }

  // ─── Internal helpers ──────────────────────────────────

  _captureScreenshot() {
    try {
      const canvas = document.getElementById('gameCanvas');
      if (canvas && canvas instanceof HTMLCanvasElement) {
        this._screenshot = canvas.toDataURL('image/png');
        const thumb = /** @type {HTMLImageElement} */ (this._$('#thumb'));
        thumb.src = this._screenshot;
        this._$('#screenshotRow').style.display = 'flex';
      } else {
        this._$('#screenshotRow').style.display = 'none';
        this._screenshot = null;
      }
    } catch {
      this._$('#screenshotRow').style.display = 'none';
      this._screenshot = null;
    }
  }

  _renderFileList() {
    const el = this._$('#fileList');
    if (this._extraFiles.length === 0) {
      el.textContent = '';
      return;
    }
    el.textContent = this._extraFiles.map((f) => f.name).join(', ');
  }

  /**
   * @param {string} msg
   * @param {'success'|'error'|''} type
   */
  _setFeedback(msg, type = '') {
    const el = this._$('#feedback');
    el.textContent = msg;
    el.className = `feedback ${type}`;
  }

  /**
   * Convert a data-URL to a Blob.
   * @param {string} dataUrl
   * @returns {Blob}
   */
  _dataUrlToBlob(dataUrl) {
    const [header, base64] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
    const bytes = atob(base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  async _submit() {
    const desc = /** @type {HTMLTextAreaElement} */ (this._$('#desc')).value.trim();
    if (!desc) {
      this._setFeedback('Please describe the bug.', 'error');
      return;
    }

    // Validate extra file sizes
    for (const f of this._extraFiles) {
      if (f.size > MAX_ATTACHMENT_SIZE) {
        this._setFeedback(`File "${f.name}" exceeds 5 MB limit.`, 'error');
        return;
      }
    }

    const submitBtn = this._$('#submitBtn');
    submitBtn.setAttribute('loading', '');
    submitBtn.setAttribute('disabled', '');
    this._setFeedback('');

    try {
      const form = new FormData();
      form.append('description', desc);
      form.append('userAgent', navigator.userAgent);
      form.append('url', window.location.href);

      // Screenshot blob
      if (this._screenshot) {
        form.append('screenshot', this._dataUrlToBlob(this._screenshot), 'screenshot.png');
      }

      // Diagnostics JSON
      if (this._diagnosticsBlob) {
        form.append('diagnostics', this._diagnosticsBlob, 'diagnostics.json');
      }

      // Extra user files
      for (const f of this._extraFiles) {
        form.append('attachments', f, f.name);
      }

      const res = await fetch('/api/bug-reports', {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error (${res.status})`);
      }

      this._setFeedback('Bug report sent — thank you! 🎉', 'success');

      // Auto-close after a short delay
      setTimeout(() => this.close(), 2000);
    } catch (err) {
      this._setFeedback(err.message || 'Failed to send report.', 'error');
    } finally {
      submitBtn.removeAttribute('loading');
      submitBtn.removeAttribute('disabled');
    }
  }
}

customElements.define('bug-report-button', BugReportButton);
