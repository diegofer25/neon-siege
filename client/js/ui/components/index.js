/**
 * @fileoverview Barrel file — imports every custom-element side-effect so that
 * a single `import './ui/components/index.js'` registers all Neon Siege
 * web components.
 *
 * Each import triggers `customElements.define(...)` for its tag name.
 * BaseComponent and shared-styles are pulled in transitively.
 */

// Global primitives
import './global/NeonButton.js';

// Feedback components
import './feedback/AchievementToast.js';
import './feedback/BugReportButton.js';
import './feedback/FloatingTexts.js';
import './feedback/WaveCountdown.js';
import './feedback/HudTooltip.js';

// Screen overlays
import './screens/SplashScreen.js';
import './screens/PauseScreen.js';
import './screens/GameOverScreen.js';
import './screens/VictoryScreen.js';
import './screens/StartScreen.js';
import './screens/SettingsModal.js';
import './screens/LoginScreen.js';
import './screens/LeaderboardScreen.js';
import './screens/AchievementsScreen.js';
import './screens/LoreIntro.js';

// Panel overlays
import './panels/LevelUpPanel.js';
import './panels/AscensionPanel.js';

// HUD (imports its own sub-components from ./hud/)
import './GameHud.js';
