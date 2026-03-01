/**
 * @fileoverview <splash-screen> — Pre-menu gateway screen with real asset loading.
 *
 * Displays a cyberpunk terminal boot sequence that requires user interaction
 * (click / tap / keypress) before the main menu loads. This satisfies the
 * browser autoplay policy so audio can play freely afterwards.
 *
 * While the narrative plays, the AssetPreloader fetches critical images, fonts,
 * and audio files so they are warm in the browser cache when the game starts.
 * A progress bar and terminal output reflect real loading state.
 *
 * No audio is played by this component.
 *
 * Events (composed, bubbling):
 *   'splash-complete' — user has interacted + assets loaded; safe to proceed
 */

import { BaseComponent } from '../BaseComponent.js';
import { createSheet } from '../shared-styles.js';
import { AssetPreloader } from '../../../utils/AssetPreloader.js';

const APP_VERSION = import.meta.env.APP_VERSION || '0.0.0';

// ── Scripted boot lines (displayed on timers — phase-tied lines added live) ──

const BOOT_LINES = [
    { text: '> NEXUS PRIME DEFENSE GRID v8.71.2', delay: 0 },
    { text: '> Initializing quantum relay...', delay: 400 },
    { text: '  ✓ Relay online', delay: 800, cls: 'success' },
    { text: '> Scanning for Swarm signatures...', delay: 1200 },
    { text: '  ⚠ THREAT LEVEL: CRITICAL', delay: 1800, cls: 'warn' },
    { text: '  ⚠ Multiple breach vectors detected', delay: 2200, cls: 'warn' },
    { text: '> Activating Project SIEGE...', delay: 2700 },
];

// scripted intro takes ~3100ms before real loading lines appear

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

  /* ── Progress bar ────────────────────────────────────────── */
  .progress-wrap {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .progress-track {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: rgba(0, 255, 255, 0.1);
    overflow: hidden;
    border: 1px solid rgba(0, 255, 255, 0.15);
  }
  .progress-fill {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, #0ff, #ff2dec);
    border-radius: 2px;
    transition: width 0.3s ease-out;
    box-shadow: 0 0 8px rgba(0, 255, 255, 0.5);
  }
  .progress-label {
    font-family: 'Courier New', Courier, monospace;
    font-size: clamp(8px, 1.2vw, 10px);
    color: rgba(0, 255, 255, 0.5);
    text-align: right;
    letter-spacing: 0.5px;
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
    /** @type {boolean} */
    _assetsReady = false;
    /** @type {boolean} */
    _userReady = false;

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
                    <div class="progress-wrap">
                        <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>
                        <div class="progress-label" id="progressLabel">Loading assets... 0%</div>
                    </div>
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

    /** Show the splash, start the boot sequence + asset loading. */
    show() {
        const root = this._$('.splash');
        if (!root) return;
        root.classList.add('show');
        root.classList.remove('exit');
        this._engaged = false;
        this._assetsReady = false;
        this._userReady = false;

        this._startBoot();
        this._startPreload();

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

    // ── Scripted terminal boot lines ─────────────────────────────────────

    /** @private */
    _startBoot() {
        const terminal = this._$('#terminal');
        if (!terminal) return;
        terminal.innerHTML = '';

        for (const line of BOOT_LINES) {
            const tid = /** @type {any} */ (setTimeout(() => {
                this._appendLine(line.text, line.cls);
            }, line.delay));
            this._timers.push(tid);
        }
    }

    /**
     * Append a line to the terminal panel.
     * @private
     * @param {string} text
     * @param {string} [cls]
     */
    _appendLine(text, cls) {
        const terminal = this._$('#terminal');
        if (!terminal) return;
        const el = document.createElement('div');
        el.className = 'term-line' + (cls ? ` ${cls}` : '');
        el.textContent = text;
        terminal.appendChild(el);
        terminal.scrollTop = terminal.scrollHeight;
    }

    // ── Real asset preloading ────────────────────────────────────────────

    /** @private */
    async _startPreload() {
        const fill = this._$('#progressFill');
        const label = this._$('#progressLabel');

        /** @type {Record<string, boolean>} phases already logged with a "Loading…" line */
        const phaseAnnounced = {};

        const phaseLabels = {
            fonts: 'Loading Neon Grid fonts',
            images: 'Downloading visual assets',
            audio: 'Warming weapon audio banks',
        };

        const preloader = new AssetPreloader(({ pct, phase }) => {
            // Update progress bar
            if (fill) fill.style.width = `${pct}%`;
            if (label) label.textContent = `Loading assets... ${pct}%`;

            // Add a terminal line the first time we enter each phase
            if (phase !== 'done' && !phaseAnnounced[phase]) {
                phaseAnnounced[phase] = true;
                this._appendLine(`> ${phaseLabels[phase] || phase}...`);
            }
        });

        try {
            await preloader.run();
        } catch {
            // Never block on load failures — game has fallbacks
        }

        // Mark loading complete in terminal
        this._appendLine('  ✓ All systems loaded', 'success');
        this._appendLine('> SIEGE PROTOCOL status: READY', 'ready');
        if (fill) fill.style.width = '100%';
        if (label) label.textContent = 'Loading complete — 100%';

        this._assetsReady = true;
        this._tryShowPrompt();
    }

    // ── User interaction ─────────────────────────────────────────────────

    /** @private */
    _onEngage = () => {
        if (this._engaged) return;
        this._engaged = true;

        // Remove the other listener (whichever didn't fire)
        const root = this._$('.splash');
        root?.removeEventListener('pointerdown', this._onEngage);
        document.removeEventListener('keydown', this._onEngage);

        this._userReady = true;
        this._tryShowPrompt();
    };

    /**
     * Check if both conditions are met: assets loaded AND user interacted.
     * If user clicked before assets finished, we wait. If assets finished
     * before the user clicked, we show the CTA prompt.
     * @private
     */
    _tryShowPrompt() {
        if (this._assetsReady && this._userReady) {
            // Both ready — proceed immediately
            this._exit();
        } else if (this._assetsReady && !this._userReady) {
            // Assets done, waiting for user
            this._appendLine('');
            this._appendLine('> Awaiting operator engagement...', 'blink');
            this._$('#prompt')?.classList.add('visible');
            this._$('#promptSub')?.classList.add('visible');
        } else if (!this._assetsReady && this._userReady) {
            // User ready, still loading — show "finishing up" message
            this._appendLine('> Finalizing asset transfer...', 'blink');
            // Poll until assets are ready
            const poll = setInterval(() => {
                if (this._assetsReady) {
                    clearInterval(poll);
                    this._exit();
                }
            }, 50);
        }
    }

    /** @private */
    _exit() {
        const root = this._$('.splash');
        root?.classList.add('exit');
        const exitDuration = 600;
        setTimeout(() => {
            this.hide();
            this._emit('splash-complete');
        }, exitDuration);
    }

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
