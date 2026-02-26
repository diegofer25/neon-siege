/**
 * @fileoverview <login-screen> — full-redesign authentication overlay.
 *
 * Layout: stepped flow with three screens (Quick Play → Login → Register)
 * instead of tabs.  Smooth screen transitions, password visibility toggles,
 * password-strength meter, loading spinners, animated enter/exit, responsive.
 *
 * Public API:
 *   show() / hide()          — animated overlay show/dismiss
 *   isVisible()              — inherited from BaseComponent
 *   setUser(user | null)     — switch between auth forms and profile view
 *   setError(message | null) — display / clear error
 *   setLoading(isLoading)    — toggle loading spinner on current submit btn
 *
 * Events (composed, bubbling):
 *   'auth-login-email'       detail: { email, password }
 *   'auth-register-email'    detail: { email, password, displayName }
 *   'auth-login-anonymous'   detail: { displayName }
 *   'auth-logout'
 *   'login-close'
 */

import { BaseComponent } from '../BaseComponent.js';
import { overlayStyles, createSheet } from '../shared-styles.js';

/* ── SVG icons ────────────────────────────────────────────────────────────── */
const EYE_OPEN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_CLOSED = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
const ARROW_LEFT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`;

/* ── Styles ───────────────────────────────────────────────────────────────── */
const styles = createSheet(/* css */ `
  :host { display: contents; }

  /* ── Container card ───────────────────────────────────────────────────── */
  .auth-container {
    position: relative;
    width: min(420px, 92vw);
    padding: var(--spacing-xl) var(--spacing-xxl);
    background: rgba(5, 1, 10, 0.92);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(0, 255, 255, 0.15);
    border-radius: var(--radius-xxl);
    box-shadow:
      0 0 30px rgba(0, 255, 255, 0.08),
      0 0 60px rgba(143, 0, 255, 0.06),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    text-align: center;
  }

  /* Subtle scan-line on the card */
  .auth-container::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 3px,
      rgba(0, 255, 255, 0.015) 3px,
      rgba(0, 255, 255, 0.015) 4px
    );
    pointer-events: none;
  }

  /* ── Close button ─────────────────────────────────────────────────────── */
  .close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 36px;
    height: 36px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.4);
    color: #888;
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    z-index: 2;
    line-height: 1;
  }
  .close-btn:hover {
    color: #fff;
    border-color: var(--color-primary-neon);
    box-shadow: 0 0 8px rgba(0, 255, 255, 0.3);
  }

  /* ── Headings ─────────────────────────────────────────────────────────── */
  .auth-heading {
    font-family: var(--font-pixel);
    color: var(--color-primary-neon);
    text-shadow: 0 0 6px var(--color-primary-neon), 0 0 12px var(--color-primary-neon);
    font-size: 20px;
    margin-bottom: var(--spacing-lg);
    letter-spacing: 2px;
  }
  .auth-heading.hero {
    font-size: 22px;
    color: var(--color-secondary-neon);
    text-shadow:
      0 0 6px var(--color-secondary-neon),
      0 0 14px var(--color-secondary-neon),
      0 0 28px var(--color-secondary-neon);
    animation: neonFlicker 3s infinite alternate;
  }

  /* ── Screens wrapper & transitions ────────────────────────────────────── */
  .screens-wrapper {
    position: relative;
    overflow: hidden;
  }
  .auth-screen {
    display: none;
    flex-direction: column;
    gap: var(--spacing-md);
    opacity: 0;
    transform: translateX(20px);
    transition: opacity 0.25s ease, transform 0.25s ease;
  }
  .auth-screen.active {
    display: flex;
    opacity: 1;
    transform: translateX(0);
  }
  .auth-screen.slide-left {
    transform: translateX(-20px);
    opacity: 0;
  }
  .auth-screen.slide-right {
    transform: translateX(20px);
    opacity: 0;
  }

  /* ── Form inputs ──────────────────────────────────────────────────────── */
  .auth-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }
  .input-wrapper {
    position: relative;
  }
  .auth-form input {
    width: 100%;
    padding: 14px 16px;
    font-size: 15px;
    font-family: var(--font-primary);
    border: 1px solid rgba(0, 255, 255, 0.25);
    border-radius: var(--radius-md);
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    box-sizing: border-box;
  }
  .auth-form input:focus {
    border-color: var(--color-primary-neon);
    box-shadow: 0 0 12px rgba(0, 255, 255, 0.3);
  }
  .auth-form input::placeholder {
    color: #555;
    font-family: var(--font-primary);
  }
  .input-wrapper.has-toggle input {
    padding-right: 48px;
  }

  /* ── Password visibility toggle ───────────────────────────────────────── */
  .pw-toggle {
    position: absolute;
    top: 50%;
    right: 12px;
    transform: translateY(-50%);
    width: 24px;
    height: 24px;
    background: none;
    border: none;
    color: #666;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
  }
  .pw-toggle:hover { color: var(--color-primary-neon); }
  .pw-toggle svg { width: 18px; height: 18px; }

  /* ── Password strength meter ──────────────────────────────────────────── */
  .strength-meter {
    display: flex;
    gap: 4px;
    margin-top: -4px;
  }
  .strength-bar {
    flex: 1;
    height: 3px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.08);
    transition: background 0.3s;
  }
  .strength-bar.active { background: var(--str-color, #f00); }
  .strength-label {
    font-size: 11px;
    text-align: right;
    margin-top: 2px;
    color: var(--str-color, #888);
    transition: color 0.3s;
    min-height: 16px;
  }

  /* ── Divider ──────────────────────────────────────────────────────────── */
  .auth-divider {
    border: none;
    height: 1px;
    background: linear-gradient(90deg,
      transparent,
      rgba(0, 255, 255, 0.25) 20%,
      rgba(255, 45, 236, 0.25) 50%,
      rgba(0, 255, 255, 0.25) 80%,
      transparent
    );
    margin: var(--spacing-sm) 0;
  }

  /* ── Secondary links ──────────────────────────────────────────────────── */
  .auth-link-row {
    font-size: 13px;
    color: #777;
    line-height: 1.6;
  }
  .auth-link {
    color: var(--color-primary-neon);
    cursor: pointer;
    text-decoration: none;
    font-weight: bold;
    transition: color 0.2s, text-shadow 0.2s;
    background: none;
    border: none;
    font-family: inherit;
    font-size: inherit;
    padding: 0;
  }
  .auth-link:hover {
    color: #fff;
    text-shadow: 0 0 8px var(--color-primary-neon);
  }
  .auth-link.secondary {
    color: var(--color-secondary-neon);
  }
  .auth-link.secondary:hover {
    text-shadow: 0 0 8px var(--color-secondary-neon);
  }

  /* ── Back button ──────────────────────────────────────────────────────── */
  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: #888;
    font-family: var(--font-primary);
    font-size: 13px;
    cursor: pointer;
    padding: 4px 0;
    margin-bottom: var(--spacing-xs);
    transition: color 0.2s;
    align-self: flex-start;
  }
  .back-btn:hover { color: var(--color-primary-neon); }
  .back-btn svg { width: 16px; height: 16px; }

  /* ── Error message ────────────────────────────────────────────────────── */
  .auth-error {
    color: var(--color-accent-red);
    font-size: 13px;
    min-height: 0;
    overflow: hidden;
    transition: min-height 0.2s, opacity 0.2s;
    opacity: 0;
  }
  .auth-error.visible {
    min-height: 20px;
    opacity: 1;
    animation: errorShake 0.4s ease-out;
  }

  /* ── Profile view ─────────────────────────────────────────────────────── */
  .profile-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md);
  }
  .avatar-circle {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: 2px solid var(--color-primary-neon);
    background: rgba(0, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-pixel);
    font-size: 22px;
    color: var(--color-primary-neon);
    text-shadow: 0 0 8px var(--color-primary-neon);
    box-shadow: 0 0 16px rgba(0, 255, 255, 0.15);
  }
  .profile-name {
    font-family: var(--font-pixel);
    font-size: 16px;
    color: var(--color-primary-neon);
    text-shadow: 0 0 6px var(--color-primary-neon);
  }
  .profile-provider {
    font-size: 12px;
    color: #888;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.03);
  }

  /* ── Keyframes ────────────────────────────────────────────────────────── */
  @keyframes errorShake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-6px); }
    40% { transform: translateX(6px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }
  @keyframes neonFlicker {
    0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% {
      text-shadow:
        0 0 6px var(--color-secondary-neon),
        0 0 14px var(--color-secondary-neon),
        0 0 28px var(--color-secondary-neon);
    }
    20%, 24%, 55% { text-shadow: none; }
  }

  /* ── Responsive ───────────────────────────────────────────────────────── */
  @media (max-width: 480px) {
    .auth-container {
      padding: var(--spacing-lg) var(--spacing-lg);
      border-radius: var(--radius-xl);
    }
    .auth-heading { font-size: 16px; }
    .auth-heading.hero { font-size: 18px; }
    .auth-form input { font-size: 16px; /* prevent iOS zoom */ }
  }
  @media (max-width: 340px) {
    .auth-heading { font-size: 14px; }
    .auth-heading.hero { font-size: 15px; }
    .auth-container { padding: var(--spacing-md) var(--spacing-md); }
  }
  @media (max-height: 600px) {
    .auth-container {
      max-height: 88vh;
      overflow-y: auto;
      padding-top: var(--spacing-lg);
      padding-bottom: var(--spacing-lg);
    }
    .auth-heading { margin-bottom: var(--spacing-sm); }
  }
`);

/* ── Component ────────────────────────────────────────────────────────────── */
class LoginScreen extends BaseComponent {
    /** @type {string} Current visible screen id */
    _currentScreen = 'quick-play';

    connectedCallback() {
        this._render(/* html */ `
            <div class="overlay">
                <div class="auth-container">
                    <button class="close-btn" id="closeBtn">&times;</button>

                    <!-- ── Profile view (logged-in) ─────────────────────── -->
                    <div id="userView" style="display:none;">
                        <h2 class="auth-heading">PROFILE</h2>
                        <div class="profile-card">
                            <div class="avatar-circle" id="avatarInitials"></div>
                            <div class="profile-name" id="userName"></div>
                            <div class="profile-provider" id="userProvider"></div>
                        </div>
                        <div style="margin-top: var(--spacing-lg);">
                            <neon-button id="logoutBtn" variant="danger">LOGOUT</neon-button>
                        </div>
                    </div>

                    <!-- ── Auth views ───────────────────────────────────── -->
                    <div id="authView">
                        <div class="auth-error" id="authError"></div>
                        <div class="screens-wrapper">

                            <!-- Screen 1: Quick Play (hero/default) -->
                            <div class="auth-screen active" id="screen-quick-play">
                                <h2 class="auth-heading hero">ENTER THE SIEGE</h2>
                                <form class="auth-form" id="anonForm">
                                    <div class="input-wrapper">
                                        <input type="text" name="displayName" placeholder="Your player name" required minlength="1" maxlength="50" autocomplete="off">
                                    </div>
                                    <neon-button type="submit" variant="primary" id="anonSubmit">PLAY AS GUEST</neon-button>
                                </form>
                                <hr class="auth-divider">
                                <div class="auth-link-row">
                                    Already have an account?
                                    <button class="auth-link" data-goto="login">Sign In</button>
                                </div>
                                <div class="auth-link-row">
                                    New here?
                                    <button class="auth-link secondary" data-goto="register">Create Account</button>
                                </div>
                            </div>

                            <!-- Screen 2: Login -->
                            <div class="auth-screen" id="screen-login">
                                <button class="back-btn" data-goto="quick-play">${ARROW_LEFT} Back</button>
                                <h2 class="auth-heading">SIGN IN</h2>
                                <form class="auth-form" id="loginForm">
                                    <div class="input-wrapper">
                                        <input type="email" name="email" placeholder="Email" required autocomplete="email">
                                    </div>
                                    <div class="input-wrapper has-toggle">
                                        <input type="password" name="password" placeholder="Password" required autocomplete="current-password">
                                        <button type="button" class="pw-toggle" aria-label="Toggle password visibility">${EYE_CLOSED}</button>
                                    </div>
                                    <neon-button type="submit" variant="primary" id="loginSubmit">LOGIN</neon-button>
                                </form>
                                <hr class="auth-divider">
                                <div class="auth-link-row">
                                    Don't have an account?
                                    <button class="auth-link secondary" data-goto="register">Create Account</button>
                                </div>
                            </div>

                            <!-- Screen 3: Register -->
                            <div class="auth-screen" id="screen-register">
                                <button class="back-btn" data-goto="quick-play">${ARROW_LEFT} Back</button>
                                <h2 class="auth-heading">CREATE ACCOUNT</h2>
                                <form class="auth-form" id="registerForm">
                                    <div class="input-wrapper">
                                        <input type="text" name="displayName" placeholder="Player name" required minlength="1" maxlength="50" autocomplete="off">
                                    </div>
                                    <div class="input-wrapper">
                                        <input type="email" name="email" placeholder="Email" required autocomplete="email">
                                    </div>
                                    <div class="input-wrapper has-toggle">
                                        <input type="password" name="password" placeholder="Password (min 6 chars)" required minlength="6" autocomplete="new-password" id="regPassword">
                                        <button type="button" class="pw-toggle" aria-label="Toggle password visibility">${EYE_CLOSED}</button>
                                    </div>
                                    <div class="strength-meter" id="strengthMeter">
                                        <div class="strength-bar"></div>
                                        <div class="strength-bar"></div>
                                        <div class="strength-bar"></div>
                                        <div class="strength-bar"></div>
                                    </div>
                                    <div class="strength-label" id="strengthLabel"></div>
                                    <neon-button type="submit" variant="primary" id="registerSubmit">CREATE ACCOUNT</neon-button>
                                </form>
                                <hr class="auth-divider">
                                <div class="auth-link-row">
                                    Already have an account?
                                    <button class="auth-link" data-goto="login">Sign In</button>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        `, overlayStyles, styles);

        this._bindEvents();
    }

    /* ── Event binding ──────────────────────────────────────────────────── */
    _bindEvents() {
        // Navigation between screens
        this.shadowRoot.querySelectorAll('[data-goto]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this._switchScreen(btn.dataset.goto);
            });
        });

        // Forms
        this._$('#anonForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            this._emit('auth-login-anonymous', { displayName: fd.get('displayName') });
        });

        this._$('#loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            this._emit('auth-login-email', { email: fd.get('email'), password: fd.get('password') });
        });

        this._$('#registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            this._emit('auth-register-email', {
                email: fd.get('email'),
                password: fd.get('password'),
                displayName: fd.get('displayName'),
            });
        });

        // Password visibility toggles
        this._$$('.pw-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => this._togglePasswordVisibility(toggle));
        });

        // Password strength meter
        this._$('#regPassword')?.addEventListener('input', (e) => {
            this._updateStrength(e.target.value);
        });

        // Close & logout
        this._$('#logoutBtn')?.addEventListener('click', () => this._emit('auth-logout'));
        this._$('#closeBtn').addEventListener('click', () => {
            this.hide();
            this._emit('login-close');
        });
    }

    /* ── Screen transitions ─────────────────────────────────────────────── */
    /** @param {string} screenId */
    _switchScreen(screenId) {
        const current = this._$(`.auth-screen.active`);
        const next = this._$(`#screen-${screenId}`);
        if (!next || current === next) return;

        // Determine slide direction
        const screens = ['quick-play', 'login', 'register'];
        const currentIdx = screens.indexOf(this._currentScreen);
        const nextIdx = screens.indexOf(screenId);
        const slideOut = nextIdx > currentIdx ? 'slide-left' : 'slide-right';
        const slideIn = nextIdx > currentIdx ? 'slide-right' : 'slide-left';

        // Slide current out
        current.classList.add(slideOut);
        current.addEventListener('transitionend', () => {
            current.classList.remove('active', slideOut);
        }, { once: true });

        // Prepare and slide next in
        next.classList.add(slideIn);
        next.offsetHeight; // reflow
        next.classList.add('active');

        requestAnimationFrame(() => {
            next.classList.remove(slideIn);
        });

        this._currentScreen = screenId;
        this.setError(null);
    }

    /* ── Animated show / hide ───────────────────────────────────────────── */
    show() {
        // Reset to first screen
        this._resetToQuickPlay();
        super.show();
    }

    hide() {
        const root = this._$('.overlay');
        if (!root || !root.classList.contains('show')) return;

        root.classList.add('hide');
        root.addEventListener('animationend', () => {
            root.classList.remove('show', 'hide');
        }, { once: true });
    }

    _resetToQuickPlay() {
        this._$$('.auth-screen').forEach(s => {
            s.classList.remove('active', 'slide-left', 'slide-right');
        });
        this._$('#screen-quick-play')?.classList.add('active');
        this._currentScreen = 'quick-play';
        this.setError(null);
    }

    /* ── Password visibility ────────────────────────────────────────────── */
    /** @param {HTMLButtonElement} toggle */
    _togglePasswordVisibility(toggle) {
        const input = toggle.parentElement.querySelector('input');
        if (!input) return;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        toggle.innerHTML = isPassword ? EYE_OPEN : EYE_CLOSED;
    }

    /* ── Password strength ──────────────────────────────────────────────── */
    /** @param {string} pw */
    _updateStrength(pw) {
        let score = 0;
        if (pw.length >= 6) score++;
        if (pw.length >= 8) score++;
        if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
        if (/\d/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;
        score = Math.min(score, 4);

        const colors = ['#f00', '#ff6b00', '#ffc800', '#0f0'];
        const labels = ['Weak', 'Fair', 'Good', 'Strong'];
        const color = pw.length === 0 ? '#888' : colors[score - 1] || '#f00';
        const label = pw.length === 0 ? '' : labels[score - 1] || 'Weak';

        const bars = this._$$('#strengthMeter .strength-bar');
        bars.forEach((bar, i) => {
            bar.classList.toggle('active', i < score);
            bar.style.setProperty('--str-color', color);
            if (i < score) bar.style.background = color;
            else bar.style.background = '';
        });

        const labelEl = this._$('#strengthLabel');
        if (labelEl) {
            labelEl.textContent = label;
            labelEl.style.setProperty('--str-color', color);
            labelEl.style.color = color;
        }
    }

    /* ── Loading state ──────────────────────────────────────────────────── */
    /** @param {boolean} loading */
    setLoading(loading) {
        const screenBtnMap = {
            'quick-play': '#anonSubmit',
            'login': '#loginSubmit',
            'register': '#registerSubmit',
        };
        const btnSel = screenBtnMap[this._currentScreen];
        const btn = btnSel ? this._$(btnSel) : null;
        if (btn) {
            if (loading) btn.setAttribute('loading', '');
            else btn.removeAttribute('loading');
        }
    }

    /* ── Auth state ─────────────────────────────────────────────────────── */
    /** @param {{ id: string, display_name: string, auth_provider: string }|null} user */
    setUser(user) {
        const authView = this._$('#authView');
        const userView = this._$('#userView');

        if (user) {
            authView.style.display = 'none';
            userView.style.display = 'block';

            // Avatar initials
            const initials = (user.display_name || '?')
                .split(/\s+/)
                .map(w => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
            this._$('#avatarInitials').textContent = initials;
            this._$('#userName').textContent = user.display_name;

            const providerLabels = { email: 'Email account', google: 'Google account', anonymous: 'Guest' };
            this._$('#userProvider').textContent = providerLabels[user.auth_provider] || user.auth_provider;
        } else {
            authView.style.display = 'block';
            userView.style.display = 'none';
            this._resetToQuickPlay();
        }
    }

    /** @param {string|null} message */
    setError(message) {
        const el = this._$('#authError');
        if (!el) return;
        if (message) {
            el.textContent = message;
            el.classList.add('visible');
        } else {
            el.classList.remove('visible');
            // Clear text after animation
            setTimeout(() => { if (!el.classList.contains('visible')) el.textContent = ''; }, 200);
        }
        this.setLoading(false);
    }
}

customElements.define('login-screen', LoginScreen);
export { LoginScreen };
