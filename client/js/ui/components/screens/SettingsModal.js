/**
 * @fileoverview <settings-modal> — game settings overlay panel.
 *
 * Public API:
 *   updateUI(settings)                          — sync all controls from a settings object
 *   setDevPanelVisible(bool)                    — show/hide the dev panel toggle row
 *   setKeybindHintsVisible(bool)                — show/hide the keybind hints text
 *   isVisible() → bool
 *   show() / hide()
 *
 * Events (composed, bubbling):
 *   'setting-change'    — { key, value } for any setting control
 *   'reset-settings'
 *   'close-settings'
 *   'toggle-dev-panel'
 */

import { BaseComponent } from '../BaseComponent.js';
import { overlayStyles, createSheet } from '../shared-styles.js';

const styles = createSheet(/* css */ `
  :host { display: contents; }
  .settings-panel {
    max-width: 640px;
    width: calc(100% - var(--spacing-xxl));
    border: 2px solid var(--color-primary-neon);
    border-radius: var(--radius-lg);
    background: var(--bg-overlay);
    padding: var(--spacing-xl);
    box-shadow: 0 0 var(--spacing-xl) rgba(0, 255, 255, 0.2);
  }
  .settings-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--spacing-md);
    margin: var(--spacing-lg) 0;
  }
  .settings-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-lg);
    color: #fff;
    font-size: 16px;
  }
  .toggle-switch {
    position: relative;
    display: inline-flex;
    width: 52px;
    height: 30px;
  }
  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }
  .toggle-slider {
    position: absolute;
    inset: 0;
    cursor: pointer;
    border-radius: 999px;
    background: #1b1b1b;
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.4);
    transition: all var(--transition-normal);
  }
  .toggle-slider::before {
    content: '';
    position: absolute;
    left: 4px;
    top: 4px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
    transition: all var(--transition-normal);
  }
  .toggle-switch input:checked + .toggle-slider {
    background: rgba(0, 255, 255, 0.2);
    border-color: var(--color-primary-neon);
    box-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
  }
  .toggle-switch input:checked + .toggle-slider::before {
    transform: translateX(22px);
    background: var(--color-primary-neon);
    box-shadow: 0 0 12px rgba(0, 255, 255, 0.6);
  }
  .toggle-switch input:focus-visible + .toggle-slider {
    outline: 2px solid var(--color-secondary-neon);
    outline-offset: 2px;
  }
  .settings-audio-control {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-sm);
  }
  .settings-audio-control input[type='range'] {
    width: 160px;
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
    cursor: pointer;
  }
  .settings-audio-control input[type='range']::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 999px;
    border: 1px solid var(--color-primary-neon);
    background: linear-gradient(90deg, var(--bg-secondary), var(--bg-tertiary));
    box-shadow: 0 0 8px rgba(0, 255, 255, 0.25);
  }
  .settings-audio-control input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    margin-top: -5px;
    border: 1px solid var(--color-secondary-neon);
    background: var(--color-primary-neon);
    box-shadow: 0 0 10px var(--color-primary-neon);
    transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  }
  .settings-audio-control input[type='range']::-moz-range-track {
    height: 6px;
    border-radius: 999px;
    border: 1px solid var(--color-primary-neon);
    background: linear-gradient(90deg, var(--bg-secondary), var(--bg-tertiary));
    box-shadow: 0 0 8px rgba(0, 255, 255, 0.25);
  }
  .settings-audio-control input[type='range']::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1px solid var(--color-secondary-neon);
    background: var(--color-primary-neon);
    box-shadow: 0 0 10px var(--color-primary-neon);
    transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  }
  .settings-audio-control input[type='range']:hover::-webkit-slider-thumb,
  .settings-audio-control input[type='range']:active::-webkit-slider-thumb,
  .settings-audio-control input[type='range']:hover::-moz-range-thumb,
  .settings-audio-control input[type='range']:active::-moz-range-thumb {
    transform: scale(1.08);
    box-shadow: 0 0 14px var(--color-secondary-neon);
  }
  .settings-audio-control input[type='range']:focus-visible {
    outline: none;
  }
  .settings-audio-control input[type='range']:focus-visible::-webkit-slider-runnable-track,
  .settings-audio-control input[type='range']:focus-visible::-moz-range-track {
    box-shadow: 0 0 0 2px var(--color-secondary-neon), 0 0 10px rgba(255, 45, 236, 0.35);
  }
  .settings-volume-value {
    min-width: 34px;
    text-align: right;
    font-family: var(--font-pixel);
    font-size: 12px;
  }
  .settings-help {
    font-size: 12px;
    opacity: 0.9;
  }
  .settings-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-md);
  }
  .settings-actions--stacked {
    flex-direction: column;
    align-items: stretch;
  }
`);

class SettingsModal extends BaseComponent {
    connectedCallback() {
        this._render(/* html */ `
            <div class="overlay">
                <div class="settings-panel">
                    <h2>Settings</h2>
                    <div class="settings-grid">
                        <label class="settings-row">
                            <span>Sound Effects</span>
                            <span class="settings-audio-control">
                                <input id="soundVolume" type="range" min="0" max="100" step="1" value="30" aria-label="Sound effects volume">
                                <span id="soundVolumeValue" class="settings-volume-value">30</span>
                            </span>
                        </label>
                        <label class="settings-row">
                            <span>Music</span>
                            <span class="settings-audio-control">
                                <input id="musicVolume" type="range" min="0" max="100" step="1" value="20" aria-label="Music volume">
                                <span id="musicVolumeValue" class="settings-volume-value">20</span>
                            </span>
                        </label>
                        <label class="settings-row">
                            <span>Screen Shake</span>
                            <span class="toggle-switch">
                                <input id="screenShake" type="checkbox" checked>
                                <span class="toggle-slider"></span>
                            </span>
                        </label>
                        <label class="settings-row">
                            <span>Performance Mode</span>
                            <span class="toggle-switch">
                                <input id="performanceMode" type="checkbox">
                                <span class="toggle-slider"></span>
                            </span>
                        </label>
                        <label class="settings-row">
                            <span>Show FPS</span>
                            <span class="toggle-switch">
                                <input id="showStats" type="checkbox">
                                <span class="toggle-slider"></span>
                            </span>
                        </label>
                        <label class="settings-row">
                            <span>Keybind Hints</span>
                            <span class="toggle-switch">
                                <input id="keybindHints" type="checkbox" checked>
                                <span class="toggle-slider"></span>
                            </span>
                        </label>
                    </div>
                    <p id="keybindHintsText" class="settings-help">Keyboard: WASD/Arrows move &bull; Q/E/R/T cast skills &bull; P pause/resume</p>
                    <div class="settings-actions settings-actions--stacked">
                        <neon-button id="resetBtn">Reset Defaults</neon-button>
                        <neon-button id="closeBtn" variant="primary">Close</neon-button>
                        <neon-button id="devBtn" variant="danger" style="display:none">⚙ Admin Panel</neon-button>
                    </div>
                </div>
            </div>
        `, overlayStyles, styles);

        this._setupControls();
    }

    /** @private */
    _setupControls() {
        // Volume sliders
        this._$('#soundVolume').addEventListener('input', (e) => {
            const value = this._clampVolume(parseInt(/** @type {HTMLInputElement} */ (e.target).value, 10), 30);
            this._$('#soundVolumeValue').textContent = value.toString();
            this._emit('setting-change', { key: 'soundVolume', value });
        });

        this._$('#musicVolume').addEventListener('input', (e) => {
            const value = this._clampVolume(parseInt(/** @type {HTMLInputElement} */ (e.target).value, 10), 20);
            this._$('#musicVolumeValue').textContent = value.toString();
            this._emit('setting-change', { key: 'musicVolume', value });
        });

        // Toggle switches
        const toggles = [
            { id: 'screenShake', key: 'screenShakeEnabled' },
            { id: 'performanceMode', key: 'performanceModeEnabled' },
            { id: 'showStats', key: 'showPerformanceStats' },
            { id: 'keybindHints', key: 'showKeybindHints' },
        ];
        for (const { id, key } of toggles) {
            this._$(`#${id}`).addEventListener('change', (e) => {
                this._emit('setting-change', { key, value: /** @type {HTMLInputElement} */ (e.target).checked });
            });
        }

        // Action buttons
        this._$('#resetBtn').addEventListener('click', () => this._emit('reset-settings'));
        this._$('#closeBtn').addEventListener('click', () => this._emit('close-settings'));
        this._$('#devBtn').addEventListener('click', () => this._emit('toggle-dev-panel'));
    }

    /**
     * Clamp a volume value to 0–100.
     * @param {number} value
     * @param {number} [fallback=0]
     * @returns {number}
     * @private
     */
    _clampVolume(value, fallback = 0) {
        if (!Number.isFinite(value)) return fallback;
        return Math.max(0, Math.min(100, Math.round(value)));
    }

    /**
     * Sync all controls from a settings object.
     * @param {{ soundVolume?: number, musicVolume?: number, screenShakeEnabled?: boolean, performanceModeEnabled?: boolean, showPerformanceStats?: boolean, showKeybindHints?: boolean }} settings
     */
    updateUI(settings) {
        const soundVol = this._clampVolume(settings.soundVolume, 30);
        const musicVol = this._clampVolume(settings.musicVolume, 20);

        /** @type {HTMLInputElement} */ (this._$('#soundVolume')).value = soundVol.toString();
        /** @type {HTMLInputElement} */ (this._$('#musicVolume')).value = musicVol.toString();
        this._$('#soundVolumeValue').textContent = soundVol.toString();
        this._$('#musicVolumeValue').textContent = musicVol.toString();

        /** @type {HTMLInputElement} */ (this._$('#screenShake')).checked = settings.screenShakeEnabled;
        /** @type {HTMLInputElement} */ (this._$('#performanceMode')).checked = settings.performanceModeEnabled;
        /** @type {HTMLInputElement} */ (this._$('#showStats')).checked = settings.showPerformanceStats;
        /** @type {HTMLInputElement} */ (this._$('#keybindHints')).checked = settings.showKeybindHints;
    }

    /** @param {boolean} visible */
    setKeybindHintsVisible(visible) {
        const el = this._$('#keybindHintsText');
        if (el) el.style.display = visible ? 'block' : 'none';
    }

    /** @param {boolean} visible */
    setDevPanelVisible(visible) {
        const btn = this._$('#devBtn');
        if (btn) btn.style.display = visible ? '' : 'none';
    }

    /** @returns {boolean} */
    isVisible() {
        return this._$('.overlay')?.classList.contains('show') || false;
    }
}

customElements.define('settings-modal', SettingsModal);
export { SettingsModal };
