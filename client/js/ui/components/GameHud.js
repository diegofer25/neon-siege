/**
 * @fileoverview <game-hud> — thin composition shell that positions and hosts
 * all HUD sub-components. Each region (health bars, skill slots, stats, etc.)
 * lives in its own shadow-DOM custom element under `./hud/`.
 *
 * HUDManager traverses nested shadow roots to cache per-element refs once,
 * so per-frame writes stay zero-overhead after initialization.
 *
 * Events relayed (from children, composed):
 *   • 'settings-click' — user clicked the settings gear button (from <hud-settings>)
 */

import { BaseComponent } from './BaseComponent.js';
import { createSheet } from './shared-styles.js';

// Import sub-components (side-effect: registers custom elements)
import './hud/HudHealthBars.js';
import './hud/HudSkillBar.js';
import './hud/HudPassiveSlots.js';
import './hud/HudAscensionBadges.js';
import './hud/HudWaveCounter.js';
import './hud/HudScore.js';
import './hud/HudCombo.js';
import './hud/HudStats.js';
import './hud/HudChallenges.js';
import './hud/HudPerformance.js';
import './hud/HudSettings.js';

// ---------------------------------------------------------------------------
// Host-level stylesheet (only positioning / pointer-events)
// ---------------------------------------------------------------------------
const hudSheet = createSheet(/* css */`
  :host {
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    bottom: 10px;
    pointer-events: none;
    z-index: var(--z-hud);
    display: block;
  }

  /* Responsive — Tablet */
  @media (max-width: 768px) {
    :host { top: 5px; left: 5px; right: 5px; bottom: 5px; }
  }

  /* Responsive — Landscape */
  @media (max-width: 900px) and (orientation: landscape) {
    :host { top: 4px; left: 4px; right: 4px; bottom: 4px; }
  }
`);

// ---------------------------------------------------------------------------
// Template — composes all sub-components
// ---------------------------------------------------------------------------
const TEMPLATE = /* html */`
  <hud-health-bars></hud-health-bars>
  <hud-skill-bar></hud-skill-bar>
  <hud-passive-slots></hud-passive-slots>
  <hud-ascension-badges></hud-ascension-badges>
  <hud-wave-counter></hud-wave-counter>
  <hud-settings></hud-settings>
  <hud-stats></hud-stats>
  <hud-score></hud-score>
  <hud-combo></hud-combo>
  <hud-challenges></hud-challenges>
  <hud-performance></hud-performance>
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
class GameHud extends BaseComponent {
    connectedCallback() {
        this._render(TEMPLATE, hudSheet);
    }
}

customElements.define('game-hud', GameHud);
