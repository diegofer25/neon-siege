/**
 * @fileoverview Main game entry point and application controller
 * Handles game initialization, input management, audio system, UI updates, and game loop
 * 
 */

import { Game } from './Game.js';
import { GameConfig } from './config/GameConfig.js';
import { telemetry } from './managers/TelemetryManager.js';
import { consentManager } from './managers/ConsentManager.js';
import { settingsManager } from './managers/SettingsManager.js';
import { saveStateManager } from './managers/SaveStateManager.js';
import { monetizationManager } from './managers/MonetizationManager.js';
import { SOUND_EFFECT_MANIFEST } from '../scripts/sfx-manifest.mjs';

//=============================================================================
// GLOBAL STATE AND CONFIGURATION
//=============================================================================

/** @type {Game|null} Global game instance */
export let game = null;

/** @type {number} Previous frame timestamp for delta calculation */
let lastTime = 0;

/** @type {boolean} Whether to show performance statistics */
let showPerformanceStats = false;

/** @type {number|null} Active animation frame request id */
let animationFrameId = null;
let settingsModalWasPlaying = false;
let adRestoreConsumedThisGameOver = false;
const RUN_DIFFICULTY_VALUES = new Set(['easy', 'normal', 'hard']);

const APP_RUNTIME_KEY = '__NEON_TD_RUNTIME__';
const appRuntime = window[APP_RUNTIME_KEY] || (window[APP_RUNTIME_KEY] = {
    initialized: false
});

const MOBILE_RESIZE_MAX_EDGE = 1024;
const MOBILE_MINOR_WIDTH_DELTA = 80;
const MOBILE_MINOR_HEIGHT_DELTA = 140;

let viewportState = {
    width: window.innerWidth,
    height: window.innerHeight,
    orientation: window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait'
};

function getViewportState() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    return {
        width,
        height,
        orientation: width >= height ? 'landscape' : 'portrait'
    };
}

function getCanvasLogicalSize(canvas) {
    return {
        width: canvas.logicalWidth || parseInt(canvas.style.width, 10) || canvas.clientWidth || canvas.width,
        height: canvas.logicalHeight || parseInt(canvas.style.height, 10) || canvas.clientHeight || canvas.height
    };
}

function shouldSkipTransientMobileResize(nextViewport) {
    const maxEdge = Math.max(nextViewport.width, nextViewport.height);
    if (maxEdge > MOBILE_RESIZE_MAX_EDGE) {
        return false;
    }

    const orientationChanged = nextViewport.orientation !== viewportState.orientation;
    if (orientationChanged) {
        return false;
    }

    const widthDelta = Math.abs(nextViewport.width - viewportState.width);
    const heightDelta = Math.abs(nextViewport.height - viewportState.height);
    const minorResize = widthDelta <= MOBILE_MINOR_WIDTH_DELTA && heightDelta <= MOBILE_MINOR_HEIGHT_DELTA;
    return minorResize && game?.gameState === 'playing';
}

/**
 * Audio system configuration and state
 * @type {Object}
 * @property {HTMLAudioElement|null} bgm - Background music element
 * @property {Object} sfx - Sound effect audio elements
 * @property {boolean} enabled - Global audio enable/disable flag
 */
const audio = {
    bgm: null,
    sfx: {},
    soundEnabled: true,
    musicEnabled: true
};

const SFX_VARIANTS = 1;

const SFX_ALIASES = {
    shoot: 'player_shoot_basic',
    explode: 'enemy_death',
    hurt: 'player_hurt',
    powerup: 'ui_purchase_success',
    click: 'ui_click'
};
let lastMenuScrollSfxAt = 0;
let lastSettingsPanelScrollTop = null;

function playMenuScrollSfx(scrollTop) {
    if (lastSettingsPanelScrollTop === null) {
        lastSettingsPanelScrollTop = scrollTop;
        return;
    }

    if (Math.abs(scrollTop - lastSettingsPanelScrollTop) < 1) {
        return;
    }

    lastSettingsPanelScrollTop = scrollTop;
    const now = performance.now();
    if (now - lastMenuScrollSfxAt < 70) {
        return;
    }

    lastMenuScrollSfxAt = now;
    playSFX('ui_menu_scroll');
}

function setupMenuScrollSoundHooks() {
    const settingsPanel = document.querySelector('.settings-panel');
    if (!settingsPanel) return;

    lastSettingsPanelScrollTop = settingsPanel.scrollTop;
    settingsPanel.addEventListener('scroll', () => {
        playMenuScrollSfx(settingsPanel.scrollTop);
    }, { passive: true });
}

/**
 * Input handling state and configuration
 * @type {Object}
 * @property {number} mouseX - Current mouse X coordinate
 * @property {number} mouseY - Current mouse Y coordinate
 * @property {boolean} mouseDown - Mouse button state
 * @property {Object} keys - Keyboard key states (keyCode -> boolean)
 * @property {HTMLCanvasElement|null} canvas - Reference to game canvas
 */
export const input = {
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    keys: {},
    canvas: null
};

function getInputElement(id) {
    return /** @type {HTMLInputElement} */ (document.getElementById(id));
}

function getButtonElement(id) {
    return /** @type {HTMLButtonElement} */ (document.getElementById(id));
}

function getStartDifficultyRoot() {
    return /** @type {HTMLElement | null} */ (document.getElementById('startDifficulty'));
}

function normalizeDifficulty(value) {
    return RUN_DIFFICULTY_VALUES.has(value) ? value : 'normal';
}

function getSelectedStartDifficulty() {
    const root = getStartDifficultyRoot();
    if (!root) {
        return 'normal';
    }

    const activeButton = /** @type {HTMLElement | null} */ (root.querySelector('.start-difficulty-option.active'));
    return normalizeDifficulty(activeButton?.dataset.difficulty || 'normal');
}

function setupStartDifficultyControls() {
    const root = getStartDifficultyRoot();
    if (!root) {
        return;
    }

    root.addEventListener('click', (event) => {
        const target = /** @type {HTMLElement | null} */ (event.target instanceof HTMLElement ? event.target : null);
        if (!target) {
            return;
        }

        const optionButton = /** @type {HTMLButtonElement | null} */ (target.closest('.start-difficulty-option'));
        if (!optionButton) {
            return;
        }

        const difficulty = normalizeDifficulty(optionButton.dataset.difficulty || 'normal');
        syncStartDifficultyUI(difficulty);
    });

    root.addEventListener('keydown', (event) => {
        const key = event.key;
        const isForward = key === 'ArrowRight' || key === 'ArrowDown';
        const isBackward = key === 'ArrowLeft' || key === 'ArrowUp';
        const isFirst = key === 'Home';
        const isLast = key === 'End';

        if (!isForward && !isBackward && !isFirst && !isLast) {
            return;
        }

        const target = /** @type {HTMLElement | null} */ (event.target instanceof HTMLElement ? event.target : null);
        const currentButton = /** @type {HTMLButtonElement | null} */ (target?.closest('.start-difficulty-option') || null);
        const optionButtons = Array.from(root.querySelectorAll('.start-difficulty-option'));
        if (optionButtons.length === 0) {
            return;
        }

        const currentIndex = Math.max(0, optionButtons.indexOf(currentButton || optionButtons[0]));
        let nextIndex = currentIndex;
        if (isFirst) {
            nextIndex = 0;
        } else if (isLast) {
            nextIndex = optionButtons.length - 1;
        } else if (isForward) {
            nextIndex = (currentIndex + 1) % optionButtons.length;
        } else if (isBackward) {
            nextIndex = (currentIndex - 1 + optionButtons.length) % optionButtons.length;
        }

        const nextButton = /** @type {HTMLButtonElement} */ (optionButtons[nextIndex]);
        const nextDifficulty = normalizeDifficulty(nextButton.dataset.difficulty || 'normal');
        event.preventDefault();
        syncStartDifficultyUI(nextDifficulty);
        nextButton.focus();
    });
}

let lastHoverSfxAt = 0;

function setupGlobalHoverSfxHooks() {
    const supportsHover = window.matchMedia?.('(hover: hover)')?.matches ?? true;
    if (!supportsHover) {
        return;
    }

    const interactiveSelector = [
        'button',
        '.shop-card',
        '.tab-button',
        '.shop-reward-btn',
        '.shop-close-btn',
        'a[href]',
        'input[type="checkbox"]',
        'input[type="range"]',
        'select',
        '[role="button"]'
    ].join(',');

    document.addEventListener('mouseover', (event) => {
        const target = /** @type {HTMLElement|null} */ (event.target instanceof HTMLElement ? event.target : null);
        if (!target) {
            return;
        }

        const interactive = target.closest(interactiveSelector);
        if (!interactive) {
            return;
        }

        const relatedTarget = /** @type {HTMLElement|null} */ (event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null);
        const previousInteractive = relatedTarget ? relatedTarget.closest(interactiveSelector) : null;
        if (previousInteractive === interactive) {
            return;
        }

        const now = performance.now();
        if (now - lastHoverSfxAt < 70) {
            return;
        }

        lastHoverSfxAt = now;
        playSFX('ui_card_hover');
    }, true);
}

//=============================================================================
// INITIALIZATION AND SETUP
//=============================================================================

/**
 * Initialize the game application
 * Sets up canvas, game instance, input handlers, audio, and UI
 */
function init() {
    if (appRuntime.initialized) {
        return;
    }
    appRuntime.initialized = true;

    const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('gameCanvas'));
    const ctx = canvas.getContext('2d');
    input.canvas = canvas;

    // Set up responsive canvas with proper scaling
    setupCanvas();
    
    // Initialize core game instance
    game = new Game(canvas, ctx);
    
    // Configure all input event listeners
    setupInputHandlers();
    
    // Handle dynamic window resizing
    window.addEventListener('resize', handleResize);

    // Avoid massive delta jumps when returning to a backgrounded tab
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            lastTime = performance.now();
        }
    });
    
    // Initialize audio system
    loadAudio();

    // Check for performance stats URL parameter fallback
    const urlParams = new URLSearchParams(window.location.search);
    const statsFromQuery = urlParams.get('stats') === 'true';

    const initialSettings = settingsManager.getSettings();
    if (statsFromQuery && !initialSettings.showPerformanceStats) {
        settingsManager.update({ showPerformanceStats: true });
    }
    applySettings(initialSettings);
    syncStartDifficultyUI();

    // Display initial start screen
    document.getElementById('startScreen').classList.add('show');

    // Initialize consent controls and prompt when no decision is stored
    consentManager.bindUI();

    telemetry.track('app_initialized', {
        userAgent: navigator.userAgent,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
    });

    // Listen for start button click to begin game
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('loadSaveBtn').addEventListener('click', () => loadGameFromSave('start_screen'));
    document.getElementById('restartBtn').addEventListener('click', restartGame);
    document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
    document.getElementById('closeSettingsBtn').addEventListener('click', closeSettingsModal);
    document.getElementById('saveGameBtn').addEventListener('click', handleSaveFromSettings);
    document.getElementById('loadGameBtn').addEventListener('click', () => loadGameFromSave('settings_menu'));
    document.getElementById('clearSaveBtn').addEventListener('click', clearSavedGame);
    document.getElementById('resetSettingsBtn').addEventListener('click', resetSettingsToDefaults);
    document.getElementById('loadAfterGameOverBtn').addEventListener('click', () => loadGameFromSave('game_over'));
    document.getElementById('restoreFromAdBtn').addEventListener('click', restoreAfterAdWatch);

    setupSettingsControls();
    setupStartDifficultyControls();
    setupGlobalHoverSfxHooks();
    setupMenuScrollSoundHooks();
    syncSaveButtons();
}

/**
 * Set up canvas dimensions and scaling for responsive design
 * Maintains 4:3 aspect ratio while adapting to container size
 * Handles high DPI displays with proper scaling
 */
function setupCanvas() {
    const canvas = input.canvas;
    const container = document.getElementById('gameContainer');
    
    // Target aspect ratio for consistent gameplay experience
    const targetAspectRatio = GameConfig.CANVAS.TARGET_ASPECT_RATIO;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const containerAspectRatio = containerWidth / containerHeight;
    const isCompactViewport = Math.min(containerWidth, containerHeight) <= 500;
    const viewportFillScale = isCompactViewport ? 0.98 : 0.95;
    
    let canvasWidth, canvasHeight;
    
    // Calculate optimal canvas size based on container aspect ratio
    if (containerAspectRatio > targetAspectRatio) {
        // Container is wider, fit to height
        canvasHeight = Math.min(containerHeight * viewportFillScale, GameConfig.CANVAS.MAX_HEIGHT);
        canvasWidth = canvasHeight * targetAspectRatio;
    } else {
        // Container is taller, fit to width
        canvasWidth = Math.min(containerWidth * viewportFillScale, GameConfig.CANVAS.MAX_WIDTH);
        canvasHeight = canvasWidth / targetAspectRatio;
    }
    
    // Ensure minimum playable size on small screens
    const minWidth = GameConfig.CANVAS.MIN_WIDTH;
    const minHeight = minWidth / targetAspectRatio;
    
    if (canvasWidth < minWidth) {
        canvasWidth = minWidth;
        canvasHeight = minHeight;
    }
    
    // Store logical dimensions (CSS pixels) for gameplay coordinates
    const logicalWidth = Math.round(canvasWidth);
    const logicalHeight = Math.round(canvasHeight);
    canvas.logicalWidth = logicalWidth;
    canvas.logicalHeight = logicalHeight;

    // Apply logical size via CSS
    canvas.style.width = logicalWidth + 'px';
    canvas.style.height = logicalHeight + 'px';

    // Handle high DPI displays by resizing the backing store
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    canvas.width = Math.round(logicalWidth * dpr);
    canvas.height = Math.round(logicalHeight * dpr);

    // Reset transform so repeated resizes don't compound scaling
    if (typeof ctx.setTransform === 'function') {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else {
        // Fallback for very old browsers
        ctx.resetTransform?.();
        ctx.scale(dpr, dpr);
    }
}

/**
 * Handle window resize events with debouncing
 * Prevents excessive recalculations during resize operations
 */
let resizeTimeout;
function handleResize() {
    // Debounce resize events to improve performance
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const nextViewport = getViewportState();
        if (shouldSkipTransientMobileResize(nextViewport)) {
            viewportState = nextViewport;
            return;
        }

        if (game) {
            const previousCanvasSize = getCanvasLogicalSize(input.canvas);
            setupCanvas();
            // Notify game of canvas size changes
            game.updateCanvasSize(previousCanvasSize);
        }

        viewportState = nextViewport;
    }, 100);
}

//=============================================================================
// INPUT SYSTEM
//=============================================================================

/**
 * Set up all input event handlers for mouse, touch, and keyboard
 * Configures event listeners for game interaction and UI controls
 */
function setupInputHandlers() {
    const canvas = input.canvas;

    // Basic mouse events for UI interaction (not for aiming)
    canvas.addEventListener('mousedown', (e) => {
        e.preventDefault();
    });

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
    }, { passive: false });

    // Keyboard input handling
    document.addEventListener('keydown', (e) => {
        input.keys[e.code] = true;
        
        // Game pause toggle
        if (e.code === 'KeyP' && (game && game.gameState === 'playing' || game.gameState === 'paused')) {
            togglePause();
        }

        if (e.code === 'Escape' && document.getElementById('settingsModal').classList.contains('show')) {
            closeSettingsModal();
        }
        
        // Prevent spacebar page scrolling
        if (e.code === 'Space') {
            e.preventDefault();
        }
    });

    document.addEventListener('keyup', (e) => {
        input.keys[e.code] = false;
    });

    // Disable right-click context menu on canvas
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

//=============================================================================
// AUDIO SYSTEM
//=============================================================================

/**
 * Initialize audio system and load sound files
 * Sets up background music and sound effect audio elements
 */
function loadAudio() {
    // Background music setup
    audio.bgm = new Audio('assets/audio/synthwave.mp3');
    audio.bgm.preload = 'auto';
    audio.bgm.loop = true;
    audio.bgm.volume = 0.3;

    // Initialize sound effect audio variants from manifest-generated files
    audio.sfx = {};
    SOUND_EFFECT_MANIFEST.forEach(({ key }) => {
        const variants = [];
        for (let variant = 1; variant <= SFX_VARIANTS; variant += 1) {
            const sound = new Audio(`assets/audio/sfx/${key}_v${variant}.mp3`);
            sound.preload = 'auto';
            sound.volume = 0.5;
            variants.push(sound);
        }
        audio.sfx[key] = variants;
    });
}

/**
 * Play a sound effect by name
 * @param {string} soundName - Name of the sound effect to play
 */
export function playSFX(soundName) {
    if (!audio.soundEnabled) return;

    const canonicalName = SFX_ALIASES[soundName] || soundName;
    const pool = audio.sfx[canonicalName];
    if (!pool || pool.length === 0) return;
    
    try {
        const source = pool[0];
        // Clone audio node to allow overlapping sounds
        const sound = source.cloneNode();
        sound.play().catch(e => console.log('Audio play failed:', e));
    } catch (e) {
        console.log('Audio error:', e);
    }
}

/**
 * Legacy mute toggle helper retained for compatibility
 * Internally updates the settings manager
 */
export function toggleMute() {
    const nextEnabled = !audio.soundEnabled;
    settingsManager.update({
        soundEnabled: nextEnabled,
        musicEnabled: nextEnabled
    });
    applySettings(settingsManager.getSettings());
}

//=============================================================================
// GAME STATE MANAGEMENT
//=============================================================================

/**
 * Start a new game session
 * Hides start screen, starts audio, and begins game loop
 */
export function startGame() {
    if (!consentManager.hasDecision()) {
        consentManager.showConsentPrompt();
        return;
    }

    document.getElementById('startScreen').classList.remove('show');
    document.getElementById('gameOver').classList.remove('show');
    playSFX('ui_start_game');
    adRestoreConsumedThisGameOver = false;

    telemetry.startSession({
        entryPoint: 'start_screen',
        statsOverlayEnabled: showPerformanceStats
    });

    const selectedDifficulty = getSelectedStartDifficulty();
    game.setRunDifficulty(selectedDifficulty);
    syncStartDifficultyUI(selectedDifficulty);
    
    // Start background music if audio is enabled
    if (audio.musicEnabled && audio.bgm) {
        audio.bgm.play().catch(e => console.log('BGM play failed:', e));
    }
    
    // Initialize game state and start main loop
    game.start();
    syncSaveButtons();
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    lastTime = performance.now();
    animationFrameId = requestAnimationFrame(gameLoop);
}

/**
 * Restart the game after game over
 * Hides game over screen and restarts game loop
 */
function restartGame() {
    document.getElementById('gameOver').classList.remove('show');
    document.getElementById('startScreen').classList.remove('show');
    playSFX('ui_restart_game');
    adRestoreConsumedThisGameOver = false;

    telemetry.track('run_restart', {
        fromWave: game.wave,
        score: game.score
    });

    game.restart();
    syncStartDifficultyUI(game.getRunDifficulty());
    syncSaveButtons();
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    lastTime = performance.now();
    animationFrameId = requestAnimationFrame(gameLoop);
}

/**
 * Toggle game pause state
 * Manages pause screen visibility and game loop execution
 */
export function togglePause() {
    if (game.gameState === 'playing') {
        playSFX('ui_pause_on');
        game.pause();
        document.getElementById('pauseScreen').classList.add('show');
        syncSaveButtons();
    } else if (game.gameState === 'paused') {
        if (document.getElementById('settingsModal').classList.contains('show')) {
            return;
        }
        playSFX('ui_pause_off');
        game.resume();
        document.getElementById('pauseScreen').classList.remove('show');
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(gameLoop);
        syncSaveButtons();
    }
}

//=============================================================================
// GAME LOOP AND RENDERING
//=============================================================================

/**
 * Main game loop - handles update and render cycles
 * @param {number} timestamp - Current frame timestamp from requestAnimationFrame
 */
function gameLoop(timestamp = 0) {
    // Skip update if game is paused
    if (game.gameState === 'paused') {
        animationFrameId = null;
        return;
    }
    
    // Calculate frame delta time for smooth animation
    const rawDelta = timestamp - lastTime;
    const delta = Math.max(0, Math.min(rawDelta, 100));
    lastTime = timestamp;
    
    // Update performance manager with current game state
    game.performanceManager?.update(delta, game.gameState);
    
    // Only update and render when game is in active states
    if (game.gameState === 'playing' || game.gameState === 'powerup') {
        // Update game logic
        game.update(delta, input);
        
        // Render current frame
        game.render();
        
        // Update user interface elements
        updateHUD();
    }
    
    // Continue loop based on game state
    if (game.gameState === 'playing' || game.gameState === 'powerup') {
        animationFrameId = requestAnimationFrame(gameLoop);
    } else {
        animationFrameId = null;
        if (game.gameState === 'gameover') {
            showGameOver();
        }
    }
}

//=============================================================================
// USER INTERFACE UPDATES
//=============================================================================

/**
 * Update all HUD (Heads-Up Display) elements
 * Refreshes health, coins, wave progress, and player stats
 */
function updateHUD() {
    // Update health bar visualization
    const healthPercentage = Math.max(0, (game.player.hp / game.player.maxHp) * 100);
    document.getElementById('healthFill').style.width = healthPercentage.toFixed(1) + '%';
    document.getElementById('healthText').textContent = `${Math.max(0, Math.floor(game.player.hp))}/${game.player.maxHp}`;
    
    // Show/hide defense bar based on shield status
    const defenseBarElement = document.getElementById('defenseBar');
    const coinDisplayElement = document.getElementById('coinDisplay');
    
    if (game.player.hasShield) {
        // Player has shield - show defense bar
        defenseBarElement.style.display = 'block';
        
        // Update defense bar visualization
        const currentDefense = game.player.shieldHp;
        const maxDefense = game.player.maxShieldHp;
        const defensePercentage = maxDefense > 0 ? Math.max(0, (currentDefense / maxDefense) * 100) : 0;
        document.getElementById('defenseFill').style.width = defensePercentage.toFixed(1) + '%';
        document.getElementById('defenseText').textContent = `${Math.max(0, Math.floor(currentDefense))}/${Math.floor(maxDefense)}`;
        
        // Adjust coin display position to be below defense bar
        // Mobile responsive positioning is handled by CSS media queries
        if (window.innerWidth <= 768) {
            coinDisplayElement.style.top = '65px'; // Tablet/mobile positioning
        } else {
            coinDisplayElement.style.top = '85px'; // Desktop positioning
        }
    } else {
        // Player doesn't have shield - hide defense bar
        defenseBarElement.style.display = 'none';
        
        // Adjust coin display position to be below health bar only
        // Mobile responsive positioning is handled by CSS media queries
        if (window.innerWidth <= 768) {
            coinDisplayElement.style.top = '35px'; // Tablet/mobile positioning
        } else {
            coinDisplayElement.style.top = '45px'; // Desktop positioning
        }
    }
    
    // Update currency display (use one decimal for consistency with fractional rewards)
    document.getElementById('coinAmount').textContent = game.player.coins.toFixed(1);
    
    // Update wave progress with enemy count using wave manager data
    const waveProgress = game.getWaveProgress();
    const remainingEnemies = game.enemies.length + waveProgress.enemiesToSpawn;
    document.getElementById('wave').textContent = `Wave: ${game.wave} (${remainingEnemies}/${waveProgress.totalEnemies})`;
    
    // Refresh player statistics display
    updateStatsDisplay();
    
    // Update performance statistics if enabled
    if (showPerformanceStats && game) {
        updatePerformanceStats();
    }
}

/**
 * Update player statistics display with current values
 * Shows attack damage, defense (HP + shield), attack speed, and rotation status
 */
function updateStatsDisplay() {
    // Calculate current attack damage with modifiers
    const baseDamage = 10;
    const currentAttack = baseDamage * game.player.damageMod;
    updateStatValue('attackValue', currentAttack.toFixed(1));
    
    // Display attack speed multiplier with rotation status (formatted to 1 decimal)
    const currentSpeed = game.player.fireRateMod.toFixed(1);
    updateStatValue('speedValue', `${currentSpeed}x`);

    // Update health regeneration rate (formatted to 1 decimal)
    const regenRate = game.player.hpRegen.toFixed(1);
    updateStatValue('regenValue', regenRate);

    // Update health per second (HPS) value
    const hpsValue = game.player.hpRegen * game.player.powerUpStacks['Regeneration'];
    updateStatValue('hpsValue', hpsValue.toFixed(1));
}

/**
 * Update individual stat value with highlight animation on change
 * @param {string} elementId - DOM element ID to update
 * @param {string|number} newValue - New value to display
 */
function updateStatValue(elementId, newValue) {
    const element = document.getElementById(elementId);
    const oldValue = element.textContent;
    
    // Only animate if value actually changed
    if (oldValue !== newValue.toString()) {
        element.textContent = newValue.toString();
        
        // Apply highlight effect for stat increases
        element.style.color = '#0f0';
        element.style.textShadow = '0 0 10px #0f0';
        element.style.transform = 'scale(1.1)';
        
        // Remove highlight after brief animation
        setTimeout(() => {
            element.style.color = '#fff';
            element.style.textShadow = '0 0 3px #fff';
            element.style.transform = 'scale(1)';
        }, 500);
    }
}

/**
 * Update performance statistics display with current values
 * Shows FPS, frame time, average FPS, and optimization status
 */
function updatePerformanceStats() {
    if (!game.performanceManager) return;
    
    const stats = game.performanceManager.getStats();
    
    // Update FPS with color coding (rounded to whole number)
    const fpsElement = document.getElementById('fpsValue');
    fpsElement.textContent = Math.round(stats.currentFps).toString();
    fpsElement.className = 'perf-value';
    if (stats.currentFps < 30) {
        fpsElement.className += ' warning';
    }
    if (stats.currentFps < 15) {
        fpsElement.className += ' critical';
    }
    
    // Update frame time (formatted to 1 decimal)
    document.getElementById('frameTimeValue').textContent = `${stats.frameTime.toFixed(1)}ms`;
    
    // Update average FPS (rounded to whole number)
    const avgFpsElement = document.getElementById('avgFpsValue');
    avgFpsElement.textContent = Math.round(stats.averageFps).toString();
    avgFpsElement.className = 'perf-value';
    if (stats.averageFps < 30) {
        avgFpsElement.className += ' warning';
    }
    if (stats.averageFps < 15) {
        avgFpsElement.className += ' critical';
    }
    
    // Update optimization status
    const optimizedElement = document.getElementById('optimizedValue');
    const isOptimized = game.performanceManager.needsOptimization();
    optimizedElement.textContent = isOptimized ? 'Yes' : 'No';
    optimizedElement.className = 'perf-value';
    if (isOptimized) {
        optimizedElement.className += ' warning';
    }
}

/**
 * Display game over screen with final statistics
 * Stops background music and shows final wave reached
 */
function showGameOver() {
    document.getElementById('finalWave').textContent = game.wave.toString();
    document.getElementById('gameOver').classList.add('show');
    syncSaveButtons();

    const hasSave = saveStateManager.hasSave();
    document.getElementById('loadAfterGameOverBtn').style.display = hasSave ? 'inline-block' : 'none';
    document.getElementById('restoreFromAdBtn').style.display = hasSave && !adRestoreConsumedThisGameOver ? 'inline-block' : 'none';

    playSFX('game_over');

    telemetry.endSession('game_over', {
        finalWave: game.wave,
        finalScore: game.score,
        finalCoins: game.player.coins
    });
    
    // Stop and reset background music
    if (audio.bgm) {
        audio.bgm.pause();
        audio.bgm.currentTime = 0;
    }
}

function applySettings(settings) {
    audio.soundEnabled = settings.soundEnabled;
    audio.musicEnabled = settings.musicEnabled;

    if (audio.bgm) {
        if (audio.musicEnabled) {
            audio.bgm.volume = GameConfig.AUDIO.BGM_VOLUME;
            if ((game?.gameState === 'playing' || game?.gameState === 'powerup') && audio.bgm.paused) {
                audio.bgm.play().catch(() => {});
            }
        } else {
            audio.bgm.volume = 0;
            audio.bgm.pause();
        }
    }

    showPerformanceStats = settings.showPerformanceStats;
    document.getElementById('performanceStats').style.display = showPerformanceStats ? 'flex' : 'none';

    document.getElementById('keybindHintsText').style.display = settings.showKeybindHints ? 'block' : 'none';

    game?.setRuntimeSettings({
        screenShakeEnabled: settings.screenShakeEnabled,
        performanceModeEnabled: settings.performanceModeEnabled
    });

    if (game?.performanceManager) {
        game.performanceManager.forcedPerformanceMode = settings.performanceModeEnabled;
    }

    updateSettingsModalUI(settings);
}

function updateSettingsModalUI(settings = settingsManager.getSettings()) {
    getInputElement('settingSoundEnabled').checked = settings.soundEnabled;
    getInputElement('settingMusicEnabled').checked = settings.musicEnabled;
    getInputElement('settingScreenShake').checked = settings.screenShakeEnabled;
    getInputElement('settingPerformanceMode').checked = settings.performanceModeEnabled;
    getInputElement('settingShowStats').checked = settings.showPerformanceStats;
    getInputElement('settingKeybindHints').checked = settings.showKeybindHints;
}

function setupSettingsControls() {
    document.getElementById('settingSoundEnabled').addEventListener('change', (event) => {
        const target = /** @type {HTMLInputElement} */ (event.currentTarget);
        const next = settingsManager.update({ soundEnabled: target.checked });
        applySettings(next);
    });

    document.getElementById('settingMusicEnabled').addEventListener('change', (event) => {
        const target = /** @type {HTMLInputElement} */ (event.currentTarget);
        const next = settingsManager.update({ musicEnabled: target.checked });
        applySettings(next);
    });

    document.getElementById('settingScreenShake').addEventListener('change', (event) => {
        const target = /** @type {HTMLInputElement} */ (event.currentTarget);
        const next = settingsManager.update({ screenShakeEnabled: target.checked });
        applySettings(next);
    });

    document.getElementById('settingPerformanceMode').addEventListener('change', (event) => {
        const target = /** @type {HTMLInputElement} */ (event.currentTarget);
        const next = settingsManager.update({ performanceModeEnabled: target.checked });
        applySettings(next);
    });

    document.getElementById('settingShowStats').addEventListener('change', (event) => {
        const target = /** @type {HTMLInputElement} */ (event.currentTarget);
        const next = settingsManager.update({ showPerformanceStats: target.checked });
        applySettings(next);
    });

    document.getElementById('settingKeybindHints').addEventListener('change', (event) => {
        const target = /** @type {HTMLInputElement} */ (event.currentTarget);
        const next = settingsManager.update({ showKeybindHints: target.checked });
        applySettings(next);
    });
}

function openSettingsModal() {
    updateSettingsModalUI();
    syncSaveButtons();
    settingsModalWasPlaying = game?.gameState === 'playing';

    if (settingsModalWasPlaying) {
        game.pause();
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    document.getElementById('settingsModal').classList.add('show');
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('show');

    if (settingsModalWasPlaying && game?.gameState === 'paused') {
        game.resume();
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
        }
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    settingsModalWasPlaying = false;
}

function handleSaveFromSettings() {
    if (!game || !game.canSaveCurrentRun()) {
        return;
    }

    const saved = saveStateManager.saveSnapshot(game.getSaveSnapshot());
    if (saved) {
        playSFX('ui_purchase_success');
        syncSaveButtons();
    }
}

function loadGameFromSave(source = 'unknown') {
    const rawSave = saveStateManager.getRawSave();
    if (!rawSave || !game) {
        return false;
    }

    const wasMenuOrGameOver = game.gameState === 'menu' || game.gameState === 'gameover';
    const restored = game.restoreFromSave(rawSave);
    if (!restored) {
        return false;
    }

    playSFX('ui_click');
    document.getElementById('startScreen').classList.remove('show');
    document.getElementById('gameOver').classList.remove('show');
    document.getElementById('pauseScreen').classList.remove('show');
    document.getElementById('settingsModal').classList.remove('show');

    if (wasMenuOrGameOver) {
        telemetry.startSession({
            entryPoint: 'save_load',
            source
        });
    }

    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
    }
    lastTime = performance.now();
    animationFrameId = requestAnimationFrame(gameLoop);

    if (audio.musicEnabled && audio.bgm) {
        audio.bgm.play().catch(() => {});
    }

    syncStartDifficultyUI(game.getRunDifficulty());

    settingsModalWasPlaying = false;
    adRestoreConsumedThisGameOver = source === 'game_over_ad' ? true : adRestoreConsumedThisGameOver;
    syncSaveButtons();
    return true;
}

function clearSavedGame() {
    if (saveStateManager.clearSave()) {
        playSFX('ui_click');
        syncSaveButtons();
    }
}

function syncSaveButtons() {
    const hasSave = saveStateManager.hasSave();

    document.getElementById('loadSaveBtn').style.display = hasSave ? 'inline-block' : 'none';
    getButtonElement('loadGameBtn').disabled = !hasSave;
    getButtonElement('clearSaveBtn').disabled = !hasSave;

    const canSaveRun = game?.canSaveCurrentRun() || false;
    getButtonElement('saveGameBtn').disabled = !canSaveRun;
}

function syncStartDifficultyUI(difficulty = game?.getRunDifficulty()) {
    const root = getStartDifficultyRoot();
    if (!root) {
        return;
    }

    const activeButton = /** @type {HTMLElement | null} */ (root.querySelector('.start-difficulty-option.active'));
    const currentDifficulty = normalizeDifficulty(activeButton?.dataset.difficulty || 'normal');
    const nextDifficulty = normalizeDifficulty(difficulty ?? currentDifficulty);
    const optionButtons = root.querySelectorAll('.start-difficulty-option');

    optionButtons.forEach((button) => {
        const option = /** @type {HTMLButtonElement} */ (button);
        const isActive = normalizeDifficulty(option.dataset.difficulty || '') === nextDifficulty;
        option.classList.toggle('active', isActive);
        option.setAttribute('aria-checked', isActive ? 'true' : 'false');
        option.tabIndex = isActive ? 0 : -1;
    });
}

async function restoreAfterAdWatch() {
    if (adRestoreConsumedThisGameOver || !saveStateManager.hasSave()) {
        return;
    }

    telemetry.track('restore_ad_requested', {
        wave: game.wave
    });

    const result = await monetizationManager.tryShowRewarded(
        'game_over_restore_save',
        { wave: game.wave },
        null
    );

    if (!result?.rewardGranted) {
        telemetry.track('restore_ad_failed', {
            wave: game.wave,
            shown: !!result?.shown
        });
        return;
    }

    adRestoreConsumedThisGameOver = true;
    telemetry.track('restore_ad_completed', {
        wave: game.wave
    });
    loadGameFromSave('game_over_ad');
}

function resetSettingsToDefaults() {
    const defaults = settingsManager.resetToDefaults();
    applySettings(defaults);
}

//=============================================================================
// VISUAL EFFECTS
//=============================================================================

/**
 * Create floating text animation effect
 * @param {string} text - Text to display
 * @param {number} x - X coordinate for text position
 * @param {number} y - Y coordinate for text position
 * @param {string} className - CSS class for styling (default: 'damage')
 */
export function createFloatingText(text, x, y, className = 'damage') {
    if (window.__NEON_TRACE_ENABLED__) {
        const stack = new Error().stack?.split('\n').slice(2, 6).map(line => line.trim());
        console.log('[TRACE floatingText.create]', {
            text,
            className,
            x: Math.round(x),
            y: Math.round(y),
            stack
        });
    }

    const textElement = document.createElement('div');
    textElement.className = `floating-text ${className}`;
    textElement.textContent = text;
    textElement.style.left = x + 'px';
    textElement.style.top = y + 'px';
    
    document.getElementById('floatingTexts').appendChild(textElement);
    
    // Auto-remove after animation completes
    setTimeout(() => {
        if (textElement.parentNode) {
            textElement.parentNode.removeChild(textElement);
        }
    }, 1000);
}

/**
 * Create screen flash effect for dramatic moments
 * Adds a brief white flash overlay to the game container
 */
export function screenFlash() {
    const flash = document.createElement('div');
    flash.className = 'screen-flash';
    document.getElementById('gameContainer').appendChild(flash);
    
    // Remove flash element after animation
    setTimeout(() => {
        if (flash.parentNode) {
            flash.parentNode.removeChild(flash);
        }
    }, 200);
}

// Initialize application when DOM content is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
    setTimeout(init, 0);
}

window.addEventListener('beforeunload', () => {
    telemetry.endSession('window_unload');
});
