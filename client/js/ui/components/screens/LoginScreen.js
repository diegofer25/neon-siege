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
 *   'auth-verify-registration' detail: { email, code }
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

  /* ── Close button (overlay top-right) ──────────────────────────────────── */
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
    position: absolute !important;
    top: 50%;
    right: 12px;
    transform: translateY(-50%);
    width: 24px;
    height: 24px;
    background: none !important;
    border: none !important;
    color: #666;
    cursor: pointer;
    padding: 0 !important;
    margin: 0 !important;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
    box-shadow: none !important;
    letter-spacing: 0 !important;
    text-transform: none !important;
    overflow: visible !important;
  }
  .pw-toggle::before { display: none !important; }
  .pw-toggle:hover {
    color: var(--color-primary-neon);
    animation: none !important;
    transform: translateY(-50%) !important;
  }
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

  /* ── Hero subtitle ──────────────────────────────────────────────────── */
  .auth-subtitle {
    font-size: 13px;
    color: #888;
    text-align: center;
    line-height: 1.55;
    margin: 0 0 var(--spacing-md) 0;
  }

  /* ── Primary CTA buttons row ─────────────────────────────────────────── */
  .auth-cta-row {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-xs);
  }
  .auth-cta-btn {
    display: block;
    max-width: 100%;
    padding: 13px var(--spacing-md);
    border-radius: var(--radius-sm);
    font-family: var(--font-primary);
    font-size: 14px;
    font-weight: bold;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
    overflow: hidden;
  }
  .auth-cta-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    background: currentColor;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .auth-cta-btn:hover::before { opacity: 0.08; }
  .auth-cta-btn.primary {
    background: transparent;
    border: 2px solid var(--color-primary-neon);
    color: var(--color-primary-neon);
    box-shadow: 0 0 14px rgba(0, 255, 255, 0.25), inset 0 0 14px rgba(0, 255, 255, 0.07);
    text-shadow: 0 0 8px var(--color-primary-neon);
  }
  .auth-cta-btn.primary:hover {
    box-shadow: 0 0 24px rgba(0, 255, 255, 0.45), inset 0 0 20px rgba(0, 255, 255, 0.12);
    transform: translateY(-1px);
  }
  .auth-cta-btn.secondary {
    background: transparent;
    border: 2px solid var(--color-secondary-neon);
    color: var(--color-secondary-neon);
    box-shadow: 0 0 14px rgba(255, 45, 236, 0.2), inset 0 0 14px rgba(255, 45, 236, 0.06);
    text-shadow: 0 0 8px var(--color-secondary-neon);
  }
  .auth-cta-btn.secondary:hover {
    box-shadow: 0 0 24px rgba(255, 45, 236, 0.4), inset 0 0 20px rgba(255, 45, 236, 0.1);
    transform: translateY(-1px);
  }

  /* ── Guest section ────────────────────────────────────────────────────── */
  .guest-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }
  .guest-label {
    font-size: 11px;
    color: #555;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .guest-form {
    gap: var(--spacing-xs) !important;
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
    background: none !important;
    border: none !important;
    font-family: inherit;
    font-size: inherit;
    padding: 0 !important;
    margin: 0 !important;
    box-shadow: none !important;
    letter-spacing: 0 !important;
    text-transform: none !important;
    display: inline !important;
    overflow: visible !important;
    position: static !important;
  }
  .auth-link::before { display: none !important; }
  .auth-link:hover {
    color: #fff;
    text-shadow: 0 0 8px var(--color-primary-neon);
    animation: none !important;
    transform: none !important;
  }
  .auth-link.secondary {
    color: var(--color-secondary-neon);
  }
  .auth-link.secondary:hover {
    text-shadow: 0 0 8px var(--color-secondary-neon);
  }

  /* ── Back button ──────────────────────────────────────────────────────── */
  .back-btn {
    display: inline-flex !important;
    align-items: center;
    gap: 6px;
    background: none !important;
    border: none !important;
    color: #888;
    font-family: var(--font-primary);
    font-size: 13px;
    cursor: pointer;
    padding: 4px 0 !important;
    margin: 0 0 var(--spacing-xs) 0 !important;
    transition: color 0.2s;
    align-self: flex-start;
    box-shadow: none !important;
    letter-spacing: 0 !important;
    text-transform: none !important;
    overflow: visible !important;
    position: static !important;
  }
  .back-btn::before { display: none !important; }
  .back-btn:hover {
    color: var(--color-primary-neon);
    animation: none !important;
    transform: none !important;
  }
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

  /* ── Avatar picker ────────────────────────────────────────────────────── */
  .avatar-circle.clickable {
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
    position: relative;
  }
  .avatar-circle.clickable:hover {
    transform: scale(1.08);
    box-shadow: 0 0 24px rgba(0, 255, 255, 0.35);
  }
  .avatar-circle .avatar-edit-hint {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid var(--color-primary-neon);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    line-height: 1;
    pointer-events: none;
  }
  .avatar-picker {
    display: none;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    padding: var(--spacing-sm) 0;
    max-width: 300px;
    margin: 0 auto;
  }
  .avatar-picker.open {
    display: flex;
    animation: avatarPickerIn 0.2s ease-out;
  }
  .avatar-option {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.15);
    background: rgba(0, 255, 255, 0.04);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    cursor: pointer;
    transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
    padding: 0;
  }
  .avatar-option:hover {
    border-color: var(--color-primary-neon);
    transform: scale(1.12);
    box-shadow: 0 0 12px rgba(0, 255, 255, 0.3);
  }
  .avatar-option.selected {
    border-color: var(--color-primary-neon);
    background: rgba(0, 255, 255, 0.12);
    box-shadow: 0 0 16px rgba(0, 255, 255, 0.4);
  }
  .avatar-picker-label {
    width: 100%;
    text-align: center;
    font-size: 11px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }
  @keyframes avatarPickerIn {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
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

  /** @type {string|null} Pending registration email awaiting code verification */
  _pendingRegistrationEmail = null;

    connectedCallback() {
        this._render(/* html */ `
            <div class="overlay">
                <button class="close-btn" id="closeBtn">&times;</button>
                <div class="auth-container">

                    <!-- ── Profile view (logged-in) ─────────────────────── -->
                    <div id="userView" style="display:none;">
                        <h2 class="auth-heading">PROFILE</h2>
                        <div class="profile-card">
                            <div class="avatar-circle clickable" id="avatarInitials" title="Change avatar">
                                <span class="avatar-edit-hint">✏️</span>
                            </div>
                            <div class="avatar-picker" id="avatarPicker">
                                <div class="avatar-picker-label">Choose your avatar</div>
                            </div>
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
                                <p class="auth-subtitle">Sign in to save your progress, climb the leaderboard, and carry upgrades across runs.</p>
                                <div class="auth-cta-row">
                                    <button class="auth-cta-btn primary" data-goto="login">SIGN IN</button>
                                    <button class="auth-cta-btn secondary" data-goto="register">CREATE ACCOUNT</button>
                                </div>
                                <hr class="auth-divider">
                                <div class="guest-section">
                                    <div class="guest-label">Or jump in without an account</div>
                                    <form class="auth-form guest-form" id="anonForm">
                                        <div class="input-wrapper">
                                            <input type="text" name="displayName" placeholder="Guest name" required minlength="1" maxlength="50" autocomplete="off">
                                        </div>
                                        <neon-button type="submit" variant="default" id="anonSubmit">PLAY AS GUEST</neon-button>
                                    </form>
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
                                <div class="auth-link-row" style="text-align:right;margin-top:6px;">
                                    <button class="auth-link" data-goto="forgot-password">Forgot password?</button>
                                </div>
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

                              <!-- Screen 4: Verify Registration Code -->
                              <div class="auth-screen" id="screen-verify-email">
                                <button class="back-btn" data-goto="register">${ARROW_LEFT} Back</button>
                                <h2 class="auth-heading">VERIFY EMAIL</h2>
                                <p class="auth-subtitle">Enter the 6-digit code we sent to <span id="verifyEmailTarget"></span></p>
                                <form class="auth-form" id="verifyForm">
                                  <div class="input-wrapper">
                                    <input type="text" name="code" placeholder="6-digit code" required minlength="6" maxlength="6" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}">
                                  </div>
                                  <neon-button type="submit" variant="primary" id="verifySubmit">VERIFY & CREATE ACCOUNT</neon-button>
                                </form>
                              </div>

                              <!-- Screen 5: Forgot Password -->
                            <div class="auth-screen" id="screen-forgot-password">
                                <button class="back-btn" data-goto="login">${ARROW_LEFT} Back</button>
                                <h2 class="auth-heading">FORGOT PASSWORD</h2>
                                <p class="auth-subtitle">Enter your email and we'll send you a reset link valid for 1 hour.</p>
                                <div id="forgotSuccess" class="forgot-success" style="display:none;">
                                    <div class="forgot-success-icon">✉️</div>
                                    <p>Check your inbox! If an account exists for that email, a reset link is on its way.</p>
                                </div>
                                <form class="auth-form" id="forgotForm">
                                    <div class="input-wrapper">
                                        <input type="email" name="email" placeholder="Your email" required autocomplete="email">
                                    </div>
                                    <neon-button type="submit" variant="primary" id="forgotSubmit">SEND RESET LINK</neon-button>
                                </form>
                            </div>

                            <!-- Screen 6: Reset Password (opened via ?reset_token= URL param) -->
                            <div class="auth-screen" id="screen-reset-password">
                                <h2 class="auth-heading">NEW PASSWORD</h2>
                                <p class="auth-subtitle">Choose a strong password for your account.</p>
                                <form class="auth-form" id="resetForm">
                                    <input type="hidden" id="resetTokenInput">
                                    <div class="input-wrapper has-toggle">
                                        <input type="password" name="newPassword" placeholder="New password (min 6 chars)" required minlength="6" autocomplete="new-password" id="resetPassword">
                                        <button type="button" class="pw-toggle" aria-label="Toggle password visibility">${EYE_CLOSED}</button>
                                    </div>
                                    <div class="strength-meter" id="resetStrengthMeter">
                                        <div class="strength-bar"></div>
                                        <div class="strength-bar"></div>
                                        <div class="strength-bar"></div>
                                        <div class="strength-bar"></div>
                                    </div>
                                    <div class="strength-label" id="resetStrengthLabel"></div>
                                    <div class="input-wrapper has-toggle">
                                        <input type="password" name="confirmPassword" placeholder="Confirm new password" required minlength="6" autocomplete="new-password" id="resetConfirmPassword">
                                        <button type="button" class="pw-toggle" aria-label="Toggle password visibility">${EYE_CLOSED}</button>
                                    </div>
                                    <neon-button type="submit" variant="primary" id="resetSubmit">SET NEW PASSWORD</neon-button>
                                </form>
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
        this.shadowRoot.querySelectorAll('[data-goto]').forEach(/** @param {HTMLElement} btn */ btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this._switchScreen(btn.dataset.goto);
            });
        });

        // Forms — neon-button renders its <button> in Shadow DOM so it isn't
        // form-associated with the light-DOM <form>. Handle click on the custom
        // element instead and call form.reportValidity() for browser validation UI.
        this._$('#anonSubmit').addEventListener('click', () => {
            const form = /** @type {HTMLFormElement} */ (this._$('#anonForm'));
            if (!form.checkValidity()) { form.reportValidity(); return; }
            const fd = new FormData(form);
            this._emit('auth-login-anonymous', { displayName: fd.get('displayName') });
        });

        this._$('#loginSubmit').addEventListener('click', () => {
            const form = /** @type {HTMLFormElement} */ (this._$('#loginForm'));
            if (!form.checkValidity()) { form.reportValidity(); return; }
            const fd = new FormData(form);
            this._emit('auth-login-email', { email: fd.get('email'), password: fd.get('password') });
        });

        this._$('#registerSubmit').addEventListener('click', () => {
            const form = /** @type {HTMLFormElement} */ (this._$('#registerForm'));
            if (!form.checkValidity()) { form.reportValidity(); return; }
            const fd = new FormData(form);
            this._emit('auth-register-email', {
                email: fd.get('email'),
                password: fd.get('password'),
                displayName: fd.get('displayName'),
            });
        });

            this._$('#verifySubmit').addEventListener('click', () => {
              const form = /** @type {HTMLFormElement} */ (this._$('#verifyForm'));
              if (!form.checkValidity()) { form.reportValidity(); return; }
              if (!this._pendingRegistrationEmail) {
                this.setError('No pending registration found. Please create your account again.');
                return;
              }
              const fd = new FormData(form);
              this._emit('auth-verify-registration', {
                email: this._pendingRegistrationEmail,
                code: String(fd.get('code') || '').trim(),
              });
            });

        this._$('#forgotSubmit').addEventListener('click', () => {
            const form = /** @type {HTMLFormElement} */ (this._$('#forgotForm'));
            if (!form.checkValidity()) { form.reportValidity(); return; }
            const fd = new FormData(form);
            this._emit('auth-forgot-password', { email: fd.get('email') });
        });

        this._$('#resetSubmit').addEventListener('click', () => {
            const form = /** @type {HTMLFormElement} */ (this._$('#resetForm'));
            if (!form.checkValidity()) { form.reportValidity(); return; }
            const newPassword = /** @type {HTMLInputElement} */ (this._$('#resetPassword')).value;
            const confirmPassword = /** @type {HTMLInputElement} */ (this._$('#resetConfirmPassword')).value;
            if (newPassword !== confirmPassword) {
                this.setError('Passwords do not match');
                return;
            }
            const token = /** @type {HTMLInputElement} */ (this._$('#resetTokenInput')).value;
            this._emit('auth-reset-password', { token, newPassword });
        });

        // Enter key on inputs — native form submit is blocked by shadow DOM,
        // so manually trigger the same logic on Enter.
        this._$('#anonForm input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._$('#anonSubmit').click();
        });
        this._$$('#loginForm input').forEach(inp => {
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this._$('#loginSubmit').click();
            });
        });
        this._$$('#registerForm input').forEach(inp => {
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this._$('#registerSubmit').click();
            });
        });
        this._$('#verifyForm input').addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this._$('#verifySubmit').click();
        });
        this._$('#forgotForm input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._$('#forgotSubmit').click();
        });
        this._$$('#resetForm input[type="password"]').forEach(inp => {
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this._$('#resetSubmit').click();
            });
        });

        // Password visibility toggles
        this._$$('.pw-toggle').forEach(/** @param {HTMLButtonElement} toggle */ toggle => {
            toggle.addEventListener('click', () => this._togglePasswordVisibility(toggle));
        });

        // Password strength meters
        this._$('#regPassword')?.addEventListener('input', (e) => {
            this._updateStrengthFor(/** @type {HTMLInputElement} */ (e.target).value, '#strengthMeter', '#strengthLabel');
        });
        this._$('#resetPassword')?.addEventListener('input', (e) => {
            this._updateStrengthFor(/** @type {HTMLInputElement} */ (e.target).value, '#resetStrengthMeter', '#resetStrengthLabel');
        });

        // Close & logout
        this._$('#logoutBtn')?.addEventListener('click', () => this._emit('auth-logout'));
        this._$('#closeBtn').addEventListener('click', () => {
            this.hide();
            this._emit('login-close');
        });

        // Avatar picker
        this._setupAvatarPicker();
    }

    /* ── Screen transitions ─────────────────────────────────────────────── */
    /** @param {string} screenId */
    _switchScreen(screenId) {
        const current = this._$(`.auth-screen.active`);
        const next = this._$(`#screen-${screenId}`);
        if (!next || current === next || this._switching) return;
        this._switching = true;

        // Determine slide direction
        const screens = ['quick-play', 'login', 'forgot-password', 'register', 'verify-email', 'reset-password'];
        const currentIdx = screens.indexOf(this._currentScreen);
        const nextIdx = screens.indexOf(screenId);
        const slideIn = nextIdx > currentIdx ? 'slide-right' : 'slide-left';

        // Phase 1 – fade out current screen
        current.style.opacity = '0';
        current.style.transform = nextIdx > currentIdx ? 'translateX(-20px)' : 'translateX(20px)';

        const onDone = () => {
            current.removeEventListener('transitionend', onDone);
            current.classList.remove('active');
            current.style.opacity = '';
            current.style.transform = '';

            // Phase 2 – slide new screen in
            next.classList.add(slideIn);
            next.offsetHeight; // reflow
            next.classList.add('active');
            requestAnimationFrame(() => {
                next.classList.remove(slideIn);
                this._switching = false;
            });
        };

        current.addEventListener('transitionend', onDone, { once: true });
        // Safety timeout in case transitionend doesn't fire
        setTimeout(() => { if (this._switching) onDone(); }, 300);

        this._currentScreen = screenId;
        this.setError(null);
    }

    /* ── Animated show / hide ───────────────────────────────────────────── */
    show() {
        // Reset to first screen
        this._resetToQuickPlay();
        super.show();
    }

    /**
     * Open the overlay directly on the registration screen.
     * @param {string} [displayName]
     */
    showRegistration(displayName = '') {
      this._resetToQuickPlay();
      super.show();
      requestAnimationFrame(() => {
        this._switchScreen('register');
        const nameInput = /** @type {HTMLInputElement|null} */ (this._$('#registerForm input[name="displayName"]'));
        if (!nameInput) return;
        const value = String(displayName || '').trim();
        if (value) {
          nameInput.value = value;
        }
      });
    }

    /**
     * Open the verification step for an in-progress email registration.
     * @param {string} email
     */
    showEmailVerification(email) {
        const normalizedEmail = String(email || '').trim();
        this._pendingRegistrationEmail = normalizedEmail || null;

        const target = this._$('#verifyEmailTarget');
        if (target) target.textContent = normalizedEmail;

        const codeInput = /** @type {HTMLInputElement|null} */ (this._$('#verifyForm input[name="code"]'));
        if (codeInput) codeInput.value = '';

        this._switchScreen('verify-email');
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
      this._pendingRegistrationEmail = null;
        this.setError(null);

      const verifyTarget = this._$('#verifyEmailTarget');
      if (verifyTarget) verifyTarget.textContent = '';
      const verifyInput = /** @type {HTMLInputElement|null} */ (this._$('#verifyForm input[name="code"]'));
      if (verifyInput) verifyInput.value = '';

        // Reset forgot-password form state
        const forgotSuccess = this._$('#forgotSuccess');
        const forgotForm = this._$('#forgotForm');
        if (forgotSuccess) forgotSuccess.style.display = 'none';
        if (forgotForm) forgotForm.style.display = 'block';
    }

    /** Open the overlay directly on the reset-password screen (skips quick-play). */
    showResetScreen(token) {
        this._$$('.auth-screen').forEach(s => s.classList.remove('active', 'slide-left', 'slide-right'));
        const screen = this._$('#screen-reset-password');
        if (screen) screen.classList.add('active');
        this._currentScreen = 'reset-password';
        this.setError(null);
        const tokenInput = /** @type {HTMLInputElement} */ (this._$('#resetTokenInput'));
        if (tokenInput) tokenInput.value = token;
        const root = this._$('.overlay');
        if (root) root.classList.add('show');
    }

    /** Hide the forgot-password form and display the success confirmation. */
    showForgotPasswordSuccess() {
        const success = this._$('#forgotSuccess');
        const form = this._$('#forgotForm');
        if (success) success.style.display = 'block';
        if (form) form.style.display = 'none';
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
        this._updateStrengthFor(pw, '#strengthMeter', '#strengthLabel');
    }

    /** @param {string} pw @param {string} meterId @param {string} labelId */
    _updateStrengthFor(pw, meterId, labelId) {
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

        const bars = this._$$(`${meterId} .strength-bar`);
        bars.forEach((bar, i) => {
            bar.classList.toggle('active', i < score);
            bar.style.setProperty('--str-color', color);
            if (i < score) bar.style.background = color;
            else bar.style.background = '';
        });

        const labelEl = this._$(labelId);
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
            'verify-email': '#verifySubmit',
            'forgot-password': '#forgotSubmit',
            'reset-password': '#resetSubmit',
        };
        const btnSel = screenBtnMap[this._currentScreen];
        const btn = btnSel ? this._$(btnSel) : null;
        if (btn) {
            if (loading) btn.setAttribute('loading', '');
            else btn.removeAttribute('loading');
        }
    }

    /* ── Avatar picker ──────────────────────────────────────────────────── */
    static AVATAR_OPTIONS = [
        '🤖', '👾', '🎯', '⚡', '🔥', '💀',
        '🛡️', '🚀', '🎮', '👽', '🧬', '💎',
        '🌟', '🦾', '🧛', '🐉', '☠️', '🎖️',
        '🌀', '🔮', '💜', '🪵', '❤️‍🔥', '🪐',
    ];
    static AVATAR_STORAGE_KEY = 'neon_siege_avatar';

    _setupAvatarPicker() {
        const avatarCircle = this._$('#avatarInitials');
        const picker = this._$('#avatarPicker');
        if (!avatarCircle || !picker) return;

        // Populate picker options
        for (const emoji of LoginScreen.AVATAR_OPTIONS) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'avatar-option';
            btn.dataset.avatar = emoji;
            btn.textContent = emoji;
            btn.title = `Select ${emoji}`;
            picker.appendChild(btn);
        }

        // Toggle picker on avatar click
        avatarCircle.addEventListener('click', () => {
            const isOpen = picker.classList.contains('open');
            picker.classList.toggle('open', !isOpen);
            // Highlight current selection
            if (!isOpen) this._highlightSelectedAvatar();
        });

        // Handle avatar selection
        picker.addEventListener('click', (e) => {
            const target = /** @type {HTMLElement} */ (e.target);
            const btn = /** @type {HTMLElement} */ (target.closest('.avatar-option'));
            if (!btn) return;
            const emoji = btn.dataset.avatar;
            this._setAvatarChoice(emoji);
            this._applyAvatar(emoji);
            picker.classList.remove('open');
        });
    }

    _highlightSelectedAvatar() {
        const saved = this._getAvatarChoice();
        const picker = this._$('#avatarPicker');
        if (!picker) return;
        picker.querySelectorAll('.avatar-option').forEach(btn => {
            btn.classList.toggle('selected', /** @type {HTMLElement} */ (btn).dataset.avatar === saved);
        });
    }

    _applyAvatar(emoji) {
        const avatarEl = this._$('#avatarInitials');
        if (!avatarEl) return;
        // Clear any text nodes but keep the edit hint
        const hint = avatarEl.querySelector('.avatar-edit-hint');
        avatarEl.textContent = '';
        // Set avatar as a text node
        const textNode = document.createTextNode(emoji);
        avatarEl.prepend(textNode);
        if (hint) avatarEl.appendChild(hint);
        // Make it larger for emoji display
        avatarEl.style.fontSize = '30px';
    }

    _setAvatarChoice(emoji) {
        try { localStorage.setItem(LoginScreen.AVATAR_STORAGE_KEY, emoji); } catch { /* ignore */ }
    }

    _getAvatarChoice() {
        try { return localStorage.getItem(LoginScreen.AVATAR_STORAGE_KEY); } catch { return null; }
    }

    /* ── Auth state ─────────────────────────────────────────────────────── */
    /** @param {{ id: string, display_name: string, auth_provider: string }|null} user */
    setUser(user) {
        const authView = this._$('#authView');
        const userView = this._$('#userView');

        if (user) {
            authView.style.display = 'none';
            userView.style.display = 'block';

            // Check for saved avatar emoji; fall back to initials
            const savedAvatar = this._getAvatarChoice();
            if (savedAvatar) {
                this._applyAvatar(savedAvatar);
            } else {
                const initials = (user.display_name || '?')
                    .split(/\s+/)
                    .map(w => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();
                const avatarEl = this._$('#avatarInitials');
                const hint = avatarEl.querySelector('.avatar-edit-hint');
                avatarEl.textContent = '';
                avatarEl.prepend(document.createTextNode(initials));
                if (hint) avatarEl.appendChild(hint);
                avatarEl.style.fontSize = '22px';
            }
            this._$('#userName').textContent = user.display_name;

            const providerLabels = { email: 'Email account', google: 'Google account', anonymous: 'Guest' };
            this._$('#userProvider').textContent = providerLabels[user.auth_provider] || user.auth_provider;

            // Close picker when switching users
            this._$('#avatarPicker')?.classList.remove('open');
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
