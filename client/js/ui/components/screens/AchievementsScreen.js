/**
 * @fileoverview <achievements-screen> — achievements overlay.
 *
 * Public API:
 *   show() / hide()
 *
 * Events (composed, bubbling):
 *   'achievements-close'
 */

import { BaseComponent } from '../BaseComponent.js';
import { overlayStyles, createSheet } from '../shared-styles.js';
import { isAuthenticated } from '../../../services/AuthService.js';
import { loadAchievementsFromServer } from '../../../services/AchievementApiService.js';
import { ACHIEVEMENTS } from '../../../systems/AchievementSystem.js';

const styles = createSheet(/* css */ `
  :host { display: contents; }

  .ach-container {
    position: relative;
    width: min(780px, 92vw);
    max-height: calc(100vh - 40px);
    min-height: min(540px, calc(100vh - 40px));
    display: flex;
    flex-direction: column;
    padding: var(--spacing-xl) var(--spacing-xxl);
    background: rgba(5, 1, 10, 0.92);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(0, 255, 255, 0.15);
    border-radius: var(--radius-xxl);
    box-shadow:
      0 0 30px rgba(0, 255, 255, 0.08),
      0 0 60px rgba(143, 0, 255, 0.06),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .ach-container::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 3px,
      rgba(0, 255, 255, 0.012) 3px,
      rgba(0, 255, 255, 0.012) 4px
    );
    pointer-events: none;
  }

  .close-btn {
    position: absolute !important;
    top: 16px;
    right: 16px;
    width: 40px;
    height: 40px;
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5) !important;
    color: #888;
    font-size: 22px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    z-index: 2;
    line-height: 1;
    padding: 0 !important;
    margin: 0 !important;
    box-shadow: none !important;
    letter-spacing: 0 !important;
    overflow: visible !important;
    min-width: 0 !important;
    text-transform: none !important;
  }
  .close-btn::before { display: none !important; }
  .close-btn:hover {
    color: #fff;
    border-color: var(--color-primary-neon) !important;
    box-shadow: 0 0 8px rgba(0, 255, 255, 0.3) !important;
    animation: none !important;
    transform: none !important;
  }

  .ach-header {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: var(--spacing-lg);
  }

  .ach-heading {
    font-family: var(--font-pixel);
    color: var(--color-secondary-neon);
    text-shadow:
      0 0 6px var(--color-secondary-neon),
      0 0 14px var(--color-secondary-neon),
      0 0 28px var(--color-secondary-neon);
    font-size: 22px;
    letter-spacing: 2px;
    margin: 0;
  }

  .ach-content {
    flex: 1;
    min-height: 0;
    border: 1px solid rgba(0, 255, 255, 0.15);
    border-radius: var(--radius-md);
    background: rgba(0, 0, 0, 0.3);
    overflow-y: auto;
    padding: var(--spacing-md);
  }

  .ach-content::-webkit-scrollbar { width: 6px; }
  .ach-content::-webkit-scrollbar-track { background: transparent; }
  .ach-content::-webkit-scrollbar-thumb {
    background: rgba(0, 255, 255, 0.2);
    border-radius: 3px;
  }

  .ach-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--spacing-sm);
  }

  .ach-item {
    display: grid;
    grid-template-columns: 42px 1fr auto;
    align-items: center;
    gap: var(--spacing-sm);
    padding: 10px 12px;
    border: 1px solid rgba(0, 255, 255, 0.2);
    border-radius: var(--radius-md);
    background: rgba(0, 255, 255, 0.05);
    text-align: left;
  }

  .ach-item.locked {
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    opacity: 0.55;
    filter: saturate(0.2);
  }

  .ach-icon {
    font-size: 26px;
    line-height: 1;
    text-align: center;
    width: 32px;
  }

  .ach-meta {
    min-width: 0;
  }

  .ach-name {
    font-family: var(--font-pixel);
    font-size: 10px;
    color: var(--color-primary-neon);
    text-shadow: 0 0 5px var(--color-primary-neon);
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ach-item.locked .ach-name {
    color: #9a9a9a;
    text-shadow: none;
  }

  .ach-desc {
    font-size: 13px;
    color: #b6b6b6;
    line-height: 1.3;
  }

  .ach-status {
    font-family: var(--font-pixel);
    font-size: 9px;
    color: var(--color-accent-green);
    text-shadow: 0 0 6px var(--color-accent-green);
    text-align: right;
    white-space: nowrap;
    margin-left: var(--spacing-sm);
  }

  .ach-item.locked .ach-status {
    color: #888;
    text-shadow: none;
  }

  .ach-message {
    min-height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    color: #ddd;
    padding: var(--spacing-xxl);
    text-align: center;
  }

  .ach-error {
    color: var(--color-accent-red);
    text-shadow: 0 0 8px rgba(255, 0, 0, 0.35);
  }

  @media (max-width: 780px) {
    .ach-container {
      width: min(94vw, 640px);
      padding: var(--spacing-lg);
      min-height: min(520px, calc(100vh - 30px));
    }

    .ach-grid {
      grid-template-columns: 1fr;
    }
  }
`);

class AchievementsScreen extends BaseComponent {
  connectedCallback() {
    this._unlockedById = new Map();

    this._render(/* html */ `
      <div class="overlay">
        <button class="close-btn" aria-label="Close">&times;</button>
        <div class="ach-container">
          <div class="ach-header">
            <h2 class="ach-heading">ACHIEVEMENTS</h2>
          </div>
          <div class="ach-content" id="content"></div>
        </div>
      </div>
    `, overlayStyles, styles);

    this._$('.close-btn').addEventListener('click', () => {
      this.hide();
      this._emit('achievements-close');
    });

    this._renderAchievements();
  }

  show() {
    super.show();

    if (!isAuthenticated()) {
      this._renderSignInPrompt();
      return;
    }

    this._loadAchievements();
  }

  hide() {
    const root = this._$('.overlay');
    if (!root || !root.classList.contains('show')) return;
    root.classList.add('hide');
    root.addEventListener('animationend', () => {
      root.classList.remove('show', 'hide');
    }, { once: true });
  }

  async _loadAchievements() {
    this._renderMessage('Loading achievements…');

    try {
      const response = await loadAchievementsFromServer();
      const unlockedById = new Map();
      const entries = Array.isArray(response?.achievements) ? response.achievements : [];
      for (const entry of entries) {
        if (!entry?.achievementId) continue;
        unlockedById.set(entry.achievementId, entry.unlockedAt ?? null);
      }
      this._unlockedById = unlockedById;
      this._renderAchievements();
    } catch {
      this._renderMessage('Could not load achievements.', true);
    }
  }

  _renderSignInPrompt() {
    this._renderMessage('Sign in to view your synced achievements.');
  }

  _renderMessage(message, isError = false) {
    const content = this._$('#content');
    if (!content) return;
    content.innerHTML = `<div class="ach-message${isError ? ' ach-error' : ''}">${this._esc(message)}</div>`;
  }

  _renderAchievements() {
    const content = this._$('#content');
    if (!content) return;

    const items = ACHIEVEMENTS.map((achievement) => {
      const unlockedAt = this._unlockedById.get(achievement.id);
      const unlocked = this._unlockedById.has(achievement.id);
      const status = unlocked
        ? (unlockedAt ? this._formatUnlockedAt(unlockedAt) : 'Unlocked')
        : 'Locked';

      return `<div class="ach-item${unlocked ? '' : ' locked'}">
        <div class="ach-icon">${achievement.icon}</div>
        <div class="ach-meta">
          <div class="ach-name">${this._esc(achievement.name)}</div>
          <div class="ach-desc">${this._esc(achievement.desc)}</div>
        </div>
        <div class="ach-status">${this._esc(status)}</div>
      </div>`;
    }).join('');

    content.innerHTML = `<div class="ach-grid">${items}</div>`;
  }

  _formatUnlockedAt(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unlocked';
    return date.toLocaleDateString();
  }

  _esc(value) {
    const el = document.createElement('span');
    el.textContent = String(value);
    return el.innerHTML;
  }
}

customElements.define('achievements-screen', AchievementsScreen);
export { AchievementsScreen };
