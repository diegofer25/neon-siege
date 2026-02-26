/**
 * @fileoverview Shared CSS utilities for Web Components.
 *
 * Provides `createSheet(cssText)` → CSSStyleSheet suitable for
 * `shadowRoot.adoptedStyleSheets`, plus a pre-built `sharedStyles` sheet
 * containing CSS custom properties, reset rules, font references, and base
 * overlay / button / typography styles needed by every component.
 */

/**
 * Create a CSSStyleSheet from a CSS string.
 * @param {string} cssText
 * @returns {CSSStyleSheet}
 */
export function createSheet(cssText) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(cssText);
    return sheet;
}

// ---------------------------------------------------------------------------
// Shared variables + reset + typography (mirrors style/base/variables.css
// and the essential bits every shadow DOM needs)
// ---------------------------------------------------------------------------

export const sharedStyles = createSheet(/* css */ `
  /* === Design Tokens (from variables.css) === */
  :host {
    /* Color Palette */
    --color-primary-neon: #0ff;
    --color-secondary-neon: #ff2dec;
    --color-tertiary-neon: #8f00ff;
    --color-accent-yellow: #ff0;
    --color-accent-green: #0f0;
    --color-accent-red: #f00;

    /* Background Colors */
    --bg-primary: #05010a;
    --bg-secondary: #1a0b2e;
    --bg-tertiary: #2d1b3d;
    --bg-overlay: rgba(0, 0, 0, 0.8);
    --bg-glass: rgba(0, 0, 0, 0.7);

    /* Gradients */
    --gradient-bg: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
    --gradient-canvas: radial-gradient(circle at center, #0a0515 0%, var(--bg-primary) 100%);
    --gradient-button: linear-gradient(45deg, var(--color-secondary-neon), var(--color-tertiary-neon));
    --gradient-health: linear-gradient(90deg, var(--color-accent-red) 0%, var(--color-accent-yellow) 50%, var(--color-accent-green) 100%);

    /* Typography */
    --font-primary: 'Audiowide', cursive;
    --font-pixel: 'Press Start 2P', monospace;

    /* Spacing */
    --spacing-xs: 4px;
    --spacing-sm: 8px;
    --spacing-md: 12px;
    --spacing-lg: 16px;
    --spacing-xl: 20px;
    --spacing-xxl: 30px;

    /* Border Radius */
    --radius-sm: 4px;
    --radius-md: 6px;
    --radius-lg: 8px;
    --radius-xl: 12px;
    --radius-xxl: 16px;

    /* Shadows */
    --shadow-neon: 0 0 10px currentColor;
    --shadow-neon-strong: 0 0 20px currentColor, 0 0 40px currentColor;
    --shadow-glass: 0 0 15px rgba(143, 0, 255, 0.3), inset 0 0 20px rgba(143, 0, 255, 0.1);

    /* Transitions */
    --transition-fast: 0.2s ease-out;
    --transition-normal: 0.3s ease;
    --transition-slow: 0.5s ease;

    /* Z-index */
    --z-hud: 10;
    --z-floating-text: 50;
    --z-overlay: 100;
    --z-flash: 200;
  }

  /* === Mini-reset for shadow DOM === */
  *, *::before, *::after {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :host {
    font-family: var(--font-primary);
    color: #fff;
    user-select: none;
    line-height: 1.4;
  }
`);

// ---------------------------------------------------------------------------
// Overlay base styles (shared by all overlay components)
// ---------------------------------------------------------------------------

export const overlayStyles = createSheet(/* css */ `
  .overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: var(--bg-overlay);
    backdrop-filter: blur(5px);
    display: none;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: var(--z-overlay);
    text-align: center;
    opacity: 0;
    transition: opacity 0.3s ease-in-out;
  }
  .overlay.show {
    display: flex;
    animation: fadeInUp 0.5s ease-out forwards;
  }
  .overlay.hide {
    animation: fadeOutDown 0.3s ease-in forwards;
  }
  /* Enhanced overlay background */
  .overlay::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background:
      radial-gradient(circle at 20% 20%, rgba(0, 255, 255, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(255, 45, 236, 0.1) 0%, transparent 50%);
    z-index: -1;
    animation: screenOverlay 10s ease-in-out infinite alternate;
  }
  /* Overlay Typography */
  .overlay h1 {
    font-family: var(--font-pixel);
    color: var(--color-secondary-neon);
    text-shadow:
      0 0 5px var(--color-secondary-neon),
      0 0 10px var(--color-secondary-neon),
      0 0 var(--spacing-xl) var(--color-secondary-neon);
    font-size: 48px;
    margin-bottom: var(--spacing-xxl);
    animation: neonFlicker 2s infinite alternate;
  }
  .overlay h2 {
    color: var(--color-primary-neon);
    text-shadow:
      0 0 5px var(--color-primary-neon),
      0 0 10px var(--color-primary-neon);
    font-size: 24px;
    margin-bottom: var(--spacing-xxl);
  }
  .overlay p {
    color: #fff;
    margin-bottom: 15px;
    font-size: 18px;
  }
  /* Overlay Buttons */
  .overlay button {
    background: var(--gradient-button);
    border: 2px solid var(--color-secondary-neon);
    color: #fff;
    padding: 15px var(--spacing-xxl);
    font-family: var(--font-primary);
    font-size: 18px;
    cursor: pointer;
    border-radius: var(--radius-lg);
    transition: all var(--transition-normal);
    box-shadow:
      0 0 10px var(--color-secondary-neon),
      0 0 var(--spacing-xl) rgba(255, 45, 236, 0.3);
    margin: 10px;
    position: relative;
    overflow: hidden;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: bold;
  }
  .overlay button::before {
    content: '';
    position: absolute;
    top: 0; left: -100%;
    width: 100%; height: 100%;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.2) 50%,
      transparent 100%);
    transition: left 0.5s;
  }
  .overlay button:hover {
    animation: buttonHover 0.3s ease-out forwards;
    text-shadow: 0 0 10px #fff;
  }
  .overlay button:hover::before { left: 100%; }
  .overlay button:active {
    transform: translateY(0) scale(0.98);
    transition: transform 0.1s ease;
  }
  .overlay button.primary {
    background: linear-gradient(45deg, var(--color-primary-neon), var(--color-secondary-neon));
    border-color: var(--color-primary-neon);
    box-shadow:
      0 0 10px var(--color-primary-neon),
      0 0 var(--spacing-xl) rgba(0, 255, 255, 0.3);
  }
  .overlay button.danger {
    background: linear-gradient(45deg, var(--color-accent-red), #ff6b6b);
    border-color: var(--color-accent-red);
    box-shadow:
      0 0 10px var(--color-accent-red),
      0 0 var(--spacing-xl) rgba(255, 0, 0, 0.3);
  }
  /* Keyframes */
  @keyframes fadeInUp {
    0% { opacity: 0; transform: translateY(30px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeOutDown {
    0% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(30px); }
  }
  @keyframes neonFlicker {
    0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% {
      text-shadow:
        0 0 5px var(--color-secondary-neon),
        0 0 10px var(--color-secondary-neon),
        0 0 var(--spacing-xl) var(--color-secondary-neon);
    }
    20%, 24%, 55% { text-shadow: none; }
  }
  @keyframes buttonHover {
    0% { transform: translateY(0) scale(1); box-shadow: 0 0 10px currentColor; }
    100% {
      transform: translateY(-3px) scale(1.05);
      box-shadow: 0 0 20px currentColor, 0 0 40px currentColor, 0 5px 15px rgba(0,0,0,0.3);
    }
  }
  @keyframes screenOverlay {
    0% { opacity: 0.5; }
    100% { opacity: 1; }
  }
  /* Game-over / victory shared stats */
  .new-record {
    font-family: var(--font-pixel);
    font-size: 16px;
    color: var(--color-accent-yellow);
    text-shadow: 0 0 8px var(--color-accent-yellow), 0 0 16px var(--color-accent-yellow);
    margin-bottom: var(--spacing-lg);
    animation: recordPulse 1s ease-in-out infinite alternate;
    letter-spacing: 2px;
  }
  .game-over-stats {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--spacing-sm);
    width: 300px;
    max-width: 90%;
    margin-bottom: var(--spacing-lg);
  }
  .go-stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(0, 255, 255, 0.2);
    border-radius: var(--radius-sm);
  }
  .go-stat-row span:first-child {
    color: #aaa;
    font-size: 14px;
  }
  .go-stat-row span:last-child {
    font-family: var(--font-pixel);
    color: var(--color-primary-neon);
    text-shadow: 0 0 4px var(--color-primary-neon);
    font-size: 12px;
  }
  .near-miss {
    font-family: var(--font-pixel);
    font-size: 11px;
    color: var(--color-secondary-neon);
    text-shadow: 0 0 6px var(--color-secondary-neon);
    margin-bottom: var(--spacing-lg);
    animation: nearMissPulse 1.5s ease-in-out infinite alternate;
  }
  @keyframes recordPulse {
    from { opacity: 0.8; transform: scale(1); }
    to   { opacity: 1;   transform: scale(1.05); }
  }
  @keyframes nearMissPulse {
    from { opacity: 0.6; }
    to   { opacity: 1; }
  }
`);
