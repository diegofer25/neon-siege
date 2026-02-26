/**
 * @fileoverview <login-screen> — authentication overlay with email, Google, and anonymous login.
 *
 * Public API:
 *   show() / hide()
 *   setUser(user | null) — update displayed user info
 *   setError(message | null)
 *
 * Events (composed, bubbling):
 *   'auth-login-email'    detail: { email, password }
 *   'auth-register-email' detail: { email, password, displayName }
 *   'auth-login-anonymous' detail: { displayName }
 *   'auth-logout'
 *   'login-close'
 */

import { BaseComponent } from '../BaseComponent.js';
import { overlayStyles, createSheet } from '../shared-styles.js';

const styles = createSheet(/* css */ `
  :host { display: contents; }
  .auth-container {
    width: min(380px, 90vw);
    text-align: center;
  }
  .auth-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: var(--spacing-lg);
    justify-content: center;
  }
  .auth-tab {
    padding: 8px 16px;
    font-size: 12px;
    font-family: var(--font-pixel);
    border: 1px solid rgba(0, 255, 255, 0.3);
    border-radius: var(--radius-sm);
    background: rgba(0, 0, 0, 0.4);
    color: #aaa;
    cursor: pointer;
    transition: all 0.2s;
  }
  .auth-tab:hover {
    border-color: var(--color-secondary-neon);
    color: #fff;
  }
  .auth-tab.active {
    border-color: var(--color-primary-neon);
    background: rgba(0, 255, 255, 0.12);
    color: var(--color-primary-neon);
  }
  .auth-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }
  .auth-form input {
    padding: 10px 14px;
    font-size: 14px;
    font-family: var(--font-main);
    border: 1px solid rgba(0, 255, 255, 0.3);
    border-radius: var(--radius-sm);
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    outline: none;
    transition: border-color 0.2s;
  }
  .auth-form input:focus {
    border-color: var(--color-primary-neon);
    box-shadow: 0 0 8px rgba(0, 255, 255, 0.3);
  }
  .auth-form input::placeholder {
    color: #666;
  }
  .auth-error {
    color: var(--color-accent-red);
    font-size: 13px;
    min-height: 20px;
  }
  .auth-user-info {
    padding: var(--spacing-md);
    border: 1px solid rgba(0, 255, 255, 0.2);
    border-radius: var(--radius-md);
    background: rgba(0, 0, 0, 0.4);
  }
  .auth-user-name {
    font-family: var(--font-pixel);
    font-size: 16px;
    color: var(--color-primary-neon);
    text-shadow: 0 0 8px var(--color-primary-neon);
    margin-bottom: var(--spacing-sm);
  }
  .auth-user-provider {
    font-size: 12px;
    color: #888;
    margin-bottom: var(--spacing-md);
  }
  .close-btn {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 32px;
    height: 32px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .close-btn:hover {
    border-color: var(--color-primary-neon);
  }
  .form-section { display: none; }
  .form-section.active { display: flex; flex-direction: column; gap: var(--spacing-md); }
`);

class LoginScreen extends BaseComponent {
    connectedCallback() {
        this._render(/* html */ `
            <div class="overlay">
                <button class="close-btn" id="closeBtn">&times;</button>
                <div class="auth-container">
                    <h2 id="authTitle">SIGN IN</h2>

                    <!-- Logged-in view -->
                    <div id="userView" style="display: none;">
                        <div class="auth-user-info">
                            <div class="auth-user-name" id="userName"></div>
                            <div class="auth-user-provider" id="userProvider"></div>
                        </div>
                        <neon-button id="logoutBtn">LOGOUT</neon-button>
                    </div>

                    <!-- Login view -->
                    <div id="authView">
                        <div class="auth-tabs">
                            <button class="auth-tab active" data-tab="anonymous">Quick Play</button>
                            <button class="auth-tab" data-tab="login">Login</button>
                            <button class="auth-tab" data-tab="register">Register</button>
                        </div>

                        <div class="auth-error" id="authError"></div>

                        <!-- Anonymous -->
                        <div class="form-section active" id="tab-anonymous">
                            <form class="auth-form" id="anonForm">
                                <input type="text" name="displayName" placeholder="Your player name" required minlength="1" maxlength="50" autocomplete="off">
                                <neon-button type="submit" variant="primary">PLAY AS GUEST</neon-button>
                            </form>
                        </div>

                        <!-- Login -->
                        <div class="form-section" id="tab-login">
                            <form class="auth-form" id="loginForm">
                                <input type="email" name="email" placeholder="Email" required autocomplete="email">
                                <input type="password" name="password" placeholder="Password" required autocomplete="current-password">
                                <neon-button type="submit" variant="primary">LOGIN</neon-button>
                            </form>
                        </div>

                        <!-- Register -->
                        <div class="form-section" id="tab-register">
                            <form class="auth-form" id="registerForm">
                                <input type="text" name="displayName" placeholder="Player name" required minlength="1" maxlength="50" autocomplete="off">
                                <input type="email" name="email" placeholder="Email" required autocomplete="email">
                                <input type="password" name="password" placeholder="Password (min 6 chars)" required minlength="6" autocomplete="new-password">
                                <neon-button type="submit" variant="primary">CREATE ACCOUNT</neon-button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `, overlayStyles, styles);

        // Tab switching
        this._$$('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => this._switchTab(tab.dataset.tab));
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

        this._$('#logoutBtn')?.addEventListener('click', () => this._emit('auth-logout'));
        this._$('#closeBtn').addEventListener('click', () => {
            this.hide();
            this._emit('login-close');
        });
    }

    /** @param {string} tabName */
    _switchTab(tabName) {
        this._$$('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
        this._$$('.form-section').forEach(s => s.classList.toggle('active', s.id === `tab-${tabName}`));
        this.setError(null);
    }

    /** @param {{ id: string, display_name: string, auth_provider: string }|null} user */
    setUser(user) {
        const authView = this._$('#authView');
        const userView = this._$('#userView');
        const title = this._$('#authTitle');

        if (user) {
            authView.style.display = 'none';
            userView.style.display = 'block';
            title.textContent = 'PROFILE';
            this._$('#userName').textContent = user.display_name;

            const providerLabels = { email: 'Email account', google: 'Google account', anonymous: 'Guest' };
            this._$('#userProvider').textContent = providerLabels[user.auth_provider] || user.auth_provider;
        } else {
            authView.style.display = 'block';
            userView.style.display = 'none';
            title.textContent = 'SIGN IN';
        }
    }

    /** @param {string|null} message */
    setError(message) {
        const el = this._$('#authError');
        if (el) el.textContent = message || '';
    }
}

customElements.define('login-screen', LoginScreen);
export { LoginScreen };
