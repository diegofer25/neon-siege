/**
 * @fileoverview <splash-screen> — Pre-menu gateway screen.
 *
 * Displays a cyberpunk terminal boot sequence that requires user interaction
 * (click / tap / keypress) before the main menu loads. This satisfies the
 * browser autoplay policy so audio can play freely afterwards.
 *
 * The narrative frames the player as the SIEGE Protocol being initialized —
 * a cold-boot sequence that ends when the operator (player) engages.
 *
 * No audio is played by this component.
 *
 * Events (composed, bubbling):
 *   'splash-complete' — user has interacted; safe to proceed & play audio
 */

import { BaseComponent } from '../BaseComponent.js';
import { createSheet } from '../shared-styles.js';

const APP_VERSION = import.meta.env.APP_VERSION || '0.0.0';

// ── Boot log lines (simulated terminal output) ──────────────────────────────

const BOOT_LINES = [
    { text: '> NEXUS PRIME DEFENSE GRID v8.71.2', delay: 0 },
    { text: '> Initializing quantum relay...', delay: 400 },
    { text: '  ✓ Relay online', delay: 800, cls: 'success' },
    { text: '> Loading Neon Grid interface...', delay: 1100 },
    { text: '  ✓ Grid sync established', delay: 1600, cls: 'success' },
    { text: '> Scanning for Swarm signatures...', delay: 2000 },
    { text: '  ⚠ THREAT LEVEL: CRITICAL', delay: 2600, cls: 'warn' },
    { text: '  ⚠ Multiple breach vectors detected', delay: 3000, cls: 'warn' },
    { text: '> Activating Project SIEGE...', delay: 3500 },
    { text: '  ✓ Weapon systems armed', delay: 4000, cls: 'success' },
    { text: '  ✓ Shield matrix calibrated', delay: 4300, cls: 'success' },
    { text: '  ✓ Skill lattice mapped', delay: 4600, cls: 'success' },
    { text: '> SIEGE PROTOCOL status: READY', delay: 5100, cls: 'ready' },
    { text: '', delay: 5500 },
    { text: '> Awaiting operator engagement...', delay: 5800, cls: 'blink' },
];

const TOTAL_BOOT_MS = 6200; // time until the prompt appears

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = createSheet(/* css */ `
  :host { display: contents; }

  .splash {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: #02050f;
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    overflow: hidden;
  }
  .splash.show {
    display: flex;
  }
  .splash.exit {
    animation: splashExit 0.6s ease-in forwards;
    pointer-events: none;
  }

  /* Scanline overlay */
  .splash::before {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent 0px,
      transparent 2px,
      rgba(0, 255, 255, 0.015) 2px,
      rgba(0, 255, 255, 0.015) 4px
    );
    pointer-events: none;
    z-index: 2;
  }

  /* Subtle grid background */
  .splash::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 30% 40%, rgba(0, 255, 255, 0.04) 0%, transparent 50%),
      radial-gradient(circle at 70% 60%, rgba(255, 45, 236, 0.03) 0%, transparent 50%);
    pointer-events: none;
    z-index: 1;
  }

  .splash-inner {
    position: relative;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 28px;
    max-width: min(92vw, 620px);
    padding: 20px;
  }

  /* ── Logo / Title ────────────────────────────────────────── */
  .splash-title {
    font-family: 'Press Start 2P', monospace;
    font-size: clamp(22px, 5vw, 38px);
    color: #0ff;
    text-shadow:
      0 0 6px #0ff,
      0 0 18px rgba(0, 255, 255, 0.5),
      0 0 40px rgba(0, 255, 255, 0.25);
    letter-spacing: 4px;
    text-align: center;
    opacity: 0;
    animation: titleReveal 1.2s ease-out 0.3s forwards;
  }

  .splash-subtitle {
    font-family: 'Audiowide', cursive;
    font-size: clamp(11px, 2vw, 14px);
    color: rgba(255, 45, 236, 0.8);
    text-shadow: 0 0 8px rgba(255, 45, 236, 0.4);
    letter-spacing: 6px;
    text-transform: uppercase;
    text-align: center;
    opacity: 0;
    animation: titleReveal 0.8s ease-out 1.0s forwards;
  }

  /* ── Terminal boot log ───────────────────────────────────── */
  .terminal {
    width: 100%;
    max-height: 260px;
    overflow: hidden;
    font-family: 'Courier New', Courier, monospace;
    font-size: clamp(10px, 1.6vw, 13px);
    line-height: 1.7;
    color: rgba(0, 255, 255, 0.65);
    text-align: left;
    padding: 12px 16px;
    border: 1px solid rgba(0, 255, 255, 0.12);
    border-radius: 6px;
    background: rgba(0, 10, 20, 0.6);
    box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.5);
  }

  .term-line {
    opacity: 0;
    transform: translateY(4px);
    animation: lineIn 0.3s ease-out forwards;
    white-space: pre-wrap;
  }
  .term-line.success { color: #0f0; }
  .term-line.warn    { color: #ff0; }
  .term-line.ready   {
    color: #0ff;
    text-shadow: 0 0 6px #0ff;
    font-weight: bold;
  }
  .term-line.blink {
    color: rgba(255, 255, 255, 0.9);
    animation: lineIn 0.3s ease-out forwards, termBlink 1s step-end infinite 0.3s;
  }

  /* ── CTA prompt ──────────────────────────────────────────── */
  .splash-prompt {
    font-family: 'Audiowide', cursive;
    font-size: clamp(14px, 2.5vw, 20px);
    color: #fff;
    text-shadow:
      0 0 6px rgba(255, 255, 255, 0.6),
      0 0 16px rgba(0, 255, 255, 0.3);
    letter-spacing: 2px;
    text-transform: uppercase;
    text-align: center;
    opacity: 0;
    pointer-events: none;
  }
  .splash-prompt.visible {
    animation: promptPulse 2s ease-in-out infinite;
  }

  .splash-prompt-sub {
    font-family: 'Courier New', Courier, monospace;
    font-size: clamp(9px, 1.4vw, 11px);
    color: rgba(255, 255, 255, 0.35);
    letter-spacing: 1px;
    text-align: center;
    margin-top: -16px;
    opacity: 0;
  }
  .splash-prompt-sub.visible {
    animation: fadeSimple 0.5s ease-out forwards;
    animation-delay: 0.5s;
  }

  /* ── Decorative corner brackets ──────────────────────────── */
  .corner { position: absolute; width: 24px; height: 24px; z-index: 4; }
  .corner::before, .corner::after {
    content: '';
    position: absolute;
    background: rgba(0, 255, 255, 0.3);
  }
  .corner-tl { top: 16px; left: 16px; }
  .corner-tl::before { top: 0; left: 0; width: 24px; height: 2px; }
  .corner-tl::after  { top: 0; left: 0; width: 2px; height: 24px; }
  .corner-tr { top: 16px; right: 16px; }
  .corner-tr::before { top: 0; right: 0; width: 24px; height: 2px; }
  .corner-tr::after  { top: 0; right: 0; width: 2px; height: 24px; }
  .corner-bl { bottom: 16px; left: 16px; }
  .corner-bl::before { bottom: 0; left: 0; width: 24px; height: 2px; }
  .corner-bl::after  { bottom: 0; left: 0; width: 2px; height: 24px; }
  .corner-br { bottom: 16px; right: 16px; }
  .corner-br::before { bottom: 0; right: 0; width: 24px; height: 2px; }
  .corner-br::after  { bottom: 0; right: 0; width: 2px; height: 24px; }

  /* ── Keyframes ───────────────────────────────────────────── */
  @keyframes titleReveal {
    0%   { opacity: 0; transform: translateY(-8px); filter: blur(4px); }
    100% { opacity: 1; transform: translateY(0);    filter: blur(0); }
  }
  @keyframes lineIn {
    0%   { opacity: 0; transform: translateY(4px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes termBlink {
    0%, 49% { opacity: 1; }
    50%, 100% { opacity: 0.3; }
  }
  @keyframes promptPulse {
    0%, 100% { opacity: 0.6; transform: scale(1); }
    50%      { opacity: 1;   transform: scale(1.03); }
  }
  @keyframes fadeSimple {
    0%   { opacity: 0; }
    100% { opacity: 1; }
  }
  @keyframes splashExit {
    0%   { opacity: 1; filter: brightness(1); }
    40%  { opacity: 1; filter: brightness(2.5); }
    100% { opacity: 0; filter: brightness(0); }
  }
`);

// ── Component ────────────────────────────────────────────────────────────────

class SplashScreen extends BaseComponent {
    /** @type {ReturnType<typeof setTimeout>[]} */
    _timers = [];
    /** @type {boolean} */
    _engaged = false;

    connectedCallback() {
        this._render(/* html */ `
            <div class="splash">
                <div class="corner corner-tl"></div>
                <div class="corner corner-tr"></div>
                <div class="corner corner-bl"></div>
                <div class="corner corner-br"></div>

                <div class="splash-inner">
                    <div class="splash-title">NEON SIEGE</div>
                    <div class="splash-subtitle" id="versionTag">Defense Protocol v${APP_VERSION}</div>
                    <div class="terminal" id="terminal"></div>
                    <div class="splash-prompt" id="prompt">[ CLICK TO ENGAGE ]</div>
                    <div class="splash-prompt-sub" id="promptSub">or press any key</div>
                </div>
            </div>
        `, styles);

        this._onEngage = this._onEngage.bind(this);
        this._syncVersion();
    }

    /** @private */
    async _syncVersion() {
        const tag = this._$('#versionTag');
        if (!tag) return;
        try {
            const res = await fetch('./package.json', { cache: 'no-store' });
            if (!res.ok) return;
            const pkg = await res.json();
            const version = typeof pkg?.version === 'string' ? pkg.version.trim() : '';
            if (version) tag.textContent = `Defense Protocol v${version}`;
        } catch { /* keep compile-time fallback */ }
    }

    /** Show the splash and kick off the boot sequence. */
    show() {
        const root = this._$('.splash');
        if (!root) return;
        root.classList.add('show');
        root.classList.remove('exit');
        this._engaged = false;
        this._startBoot();

        // Listen for any interaction
        root.addEventListener('pointerdown', this._onEngage, { once: true });
        document.addEventListener('keydown', this._onEngage, { once: true });
    }

    /** Hide immediately (used if we want to skip without animation). */
    hide() {
        this._cleanup();
        const root = this._$('.splash');
        root?.classList.remove('show', 'exit');
    }

    /** @private */
    _startBoot() {
        const terminal = this._$('#terminal');
        if (!terminal) return;
        terminal.innerHTML = '';

        for (const line of BOOT_LINES) {
            const tid = /** @type {any} */ (setTimeout(() => {
                const el = document.createElement('div');
                el.className = 'term-line' + (line.cls ? ` ${line.cls}` : '');
                el.textContent = line.text;
                terminal.appendChild(el);
                // Auto-scroll
                terminal.scrollTop = terminal.scrollHeight;
            }, line.delay));
            this._timers.push(tid);
        }

        // Show CTA prompt after boot completes
        const promptTid = /** @type {any} */ (setTimeout(() => {
            this._$('#prompt')?.classList.add('visible');
            this._$('#promptSub')?.classList.add('visible');
        }, TOTAL_BOOT_MS));
        this._timers.push(promptTid);
    }

    /** @private */
    _onEngage = () => {
        if (this._engaged) return;
        this._engaged = true;

        // Remove the other listener (whichever didn't fire)
        const root = this._$('.splash');
        root?.removeEventListener('pointerdown', this._onEngage);
        document.removeEventListener('keydown', this._onEngage);

        // Play exit animation, then emit event
        root?.classList.add('exit');
        const exitDuration = 600;
        setTimeout(() => {
            this.hide();
            this._emit('splash-complete');
        }, exitDuration);
    };

    /** @private */
    _cleanup() {
        for (const t of this._timers) clearTimeout(t);
        this._timers.length = 0;
    }

    disconnectedCallback() {
        this._cleanup();
        const root = this._$('.splash');
        root?.removeEventListener('pointerdown', this._onEngage);
        document.removeEventListener('keydown', this._onEngage);
    }
}

customElements.define('splash-screen', SplashScreen);
export { SplashScreen };
