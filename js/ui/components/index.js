/**
 * @fileoverview Barrel file — imports every custom-element side-effect so that
 * a single `import './ui/components/index.js'` registers all Neon Siege
 * web components.
 *
 * Each import triggers `customElements.define(...)` for its tag name.
 * BaseComponent and shared-styles are pulled in transitively.
 */

// Phase 1 – leaf components
import './PauseScreen.js';
import './WaveCountdown.js';
import './AchievementToast.js';
import './FloatingTexts.js';

// Phase 2 – overlay components
import './GameOverScreen.js';
import './VictoryScreen.js';
import './StartScreen.js';
import './SettingsModal.js';

// Phase 3 – complex overlays
import './LevelUpPanel.js';
import './AscensionPanel.js';
import './HudTooltip.js';

// Phase 4 – HUD
import './GameHud.js';
