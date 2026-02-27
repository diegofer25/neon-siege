/**
 * @fileoverview Main game entry point and application controller
 * Handles game initialization, input management, audio system, UI updates, and game loop
 * 
 */

import { Game } from './Game.js';
import { GameConfig } from './config/GameConfig.js';
import { telemetry } from './managers/TelemetryManager.js';
import { settingsManager } from './managers/SettingsManager.js';
import { saveStateManager } from './managers/SaveStateManager.js';
import { audioManager } from './managers/AudioManager.js';
import { hudManager } from './managers/HUDManager.js';
import { skillUI } from './ui/SkillUIController.js';
import { DevPanel } from './ui/DevPanel.js';
import * as authService from './services/AuthService.js';

// Web Components (side-effect: registers all custom elements)
import './ui/components/index.js';

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
 * Audio system is now managed by AudioManager singleton.
 * See managers/AudioManager.js
 */

function setupMenuScrollSoundHooks() {
    audioManager.setupMenuScrollSoundHooks();
}

function syncMusicTrack(opts) {
    audioManager.syncMusicTrack(opts);
}

function setupAudioUnlockHooks() {
    audioManager.setupAudioUnlockHooks();
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
async function init() {
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
    audioManager.game = game;
    hudManager.game = game;
    skillUI.game = game;

    // Developer panel (gated by ?dev=true)
    const devPanel = new DevPanel(game);
    appRuntime.devPanel = devPanel;
    
    // Configure all input event listeners
    setupInputHandlers();
    hudManager.setupTooltips();
    
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
    syncMusicTrack();
    setupAudioUnlockHooks();

    // Check for performance stats URL parameter fallback
    const urlParams = new URLSearchParams(window.location.search);
    const statsFromQuery = urlParams.get('stats') === 'true';

    const initialSettings = settingsManager.getSettings();
    if (statsFromQuery && !initialSettings.showPerformanceStats) {
        settingsManager.update({ showPerformanceStats: true });
    }
    applySettings(initialSettings);
    syncStartDifficultyUI();

    // Expose state system on window for debugging (only in debug mode)
    if (urlParams.has('debug')) {
        /** @type {any} */ (window).__NEON_STATE__ = {
            get store() { return game?.store; },
            get fsm() { return game?.fsm; },
            get dispatcher() { return game?.dispatcher; },
        };
    }

    // Display initial start screen
    document.querySelector('start-screen').show();

    telemetry.track('app_initialized', {
        userAgent: navigator.userAgent,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
    });

    // Wire up Web Component events
    const startScreen = document.querySelector('start-screen');
    const gameOverScreen = document.querySelector('game-over-screen');
    const victoryScreen = document.querySelector('victory-screen');
    const settingsModalEl = document.querySelector('settings-modal');
    const gameHudEl = document.querySelector('game-hud');

    // Gate game start behind authentication
    let pendingStartGame = false;
    startScreen.addEventListener('start-game', () => {
        if (authService.isAuthenticated()) {
            startGame();
        } else {
            pendingStartGame = true;
            loginScreen.setUser(null);
            loginScreen.show();
        }
    });
    gameOverScreen.addEventListener('restart', restartGame);
    gameOverScreen.addEventListener('load-save', () => loadGameFromSave('game_over'));
    victoryScreen.addEventListener('continue-endless', continueToEndless);
    victoryScreen.addEventListener('return-to-menu', restartFromVictory);

    gameHudEl.addEventListener('settings-click', openSettingsModal);
    settingsModalEl.addEventListener('close-settings', closeSettingsModal);
    settingsModalEl.addEventListener('load-game', () => loadGameFromSave('settings_menu'));
    settingsModalEl.addEventListener('clear-save', clearSavedGame);
    settingsModalEl.addEventListener('reset-settings', resetSettingsToDefaults);
    settingsModalEl.addEventListener('setting-change', handleSettingChange);
    settingsModalEl.addEventListener('toggle-dev-panel', () => {
        appRuntime.devPanel?.toggle();
        closeSettingsModal();
    });

    // Show Admin Panel button in settings if ?dev=true
    if (appRuntime.devPanel?.enabled) {
        settingsModalEl.setDevPanelVisible(true);
    }

    // Auth & leaderboard screens
    const loginScreen = document.querySelector('login-screen');
    const leaderboardScreen = document.querySelector('leaderboard-screen');

    // Show leaderboard from any screen
    const showLeaderboard = () => leaderboardScreen.show();
    startScreen.addEventListener('show-leaderboard', showLeaderboard);
    gameOverScreen.addEventListener('show-leaderboard', showLeaderboard);
    victoryScreen.addEventListener('show-leaderboard', showLeaderboard);

    // Show login/profile
    startScreen.addEventListener('show-login', () => {
        loginScreen.setUser(authService.getCurrentUser());
        loginScreen.show();
    });

    // Auth events
    /** After successful auth, auto-start if the user clicked "Start" before logging in.
     *  Also pull the server's save state so the save button reflects the server copy. */
    const _onAuthSuccess = () => {
        loginScreen.hide();
        // Sync save from server after login so save buttons update correctly
        saveStateManager.init().then(syncSaveButtons);
        if (pendingStartGame) {
            pendingStartGame = false;
            startGame();
        }
    };

    loginScreen.addEventListener('auth-login-anonymous', async (e) => {
        const { displayName } = /** @type {CustomEvent} */ (e).detail;
        try {
            loginScreen.setError(null);
            loginScreen.setLoading(true);
            await authService.loginAnonymous(displayName);
            loginScreen.setLoading(false);
            loginScreen.setUser(authService.getCurrentUser());
            _onAuthSuccess();
        } catch (err) {
            loginScreen.setError(err.message);
        }
    });

    loginScreen.addEventListener('auth-login-email', async (e) => {
        const { email, password } = /** @type {CustomEvent} */ (e).detail;
        try {
            loginScreen.setError(null);
            loginScreen.setLoading(true);
            await authService.loginEmail(email, password);
            loginScreen.setLoading(false);
            loginScreen.setUser(authService.getCurrentUser());
            _onAuthSuccess();
        } catch (err) {
            loginScreen.setError(err.message);
        }
    });

    loginScreen.addEventListener('auth-register-email', async (e) => {
        const { email, password, displayName } = /** @type {CustomEvent} */ (e).detail;
        try {
            loginScreen.setError(null);
            loginScreen.setLoading(true);
            await authService.registerEmail(email, password, displayName);
            loginScreen.setLoading(false);
            loginScreen.setUser(authService.getCurrentUser());
            _onAuthSuccess();
        } catch (err) {
            loginScreen.setError(err.message);
        }
    });

    loginScreen.addEventListener('login-close', () => {
        pendingStartGame = false;
    });

    loginScreen.addEventListener('auth-logout', async () => {
        await authService.logout();
        loginScreen.setUser(null);
        startScreen.setAuthUser(null);
    });

    // Update start screen button when auth changes
    authService.onAuthChange((user) => {
        startScreen.setAuthUser(user);
    });

    // Try restoring session from refresh token, then sync save state from server
    await authService.restoreSession();
    await saveStateManager.init();

    setupGlobalHoverSfxHooks();
    setupMenuScrollSoundHooks();
    syncSaveButtons();
    populateLastRunStats();
}

/**
 * Set up canvas dimensions and scaling for responsive design
 * Maintains 4:3 aspect ratio while adapting to container size
 * Handles high DPI displays with proper scaling
 */
function setupCanvas() {
    const canvas = input.canvas;
    const container = document.getElementById('gameContainer');
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Fill the entire container — no aspect ratio enforcement, no margins
    let canvasWidth = containerWidth;
    let canvasHeight = containerHeight;
    
    // Ensure minimum playable size on small screens
    const minWidth = GameConfig.CANVAS.MIN_WIDTH;
    const minHeight = Math.round(minWidth * 0.75);
    
    if (canvasWidth < minWidth) {
        canvasWidth = minWidth;
        canvasHeight = Math.max(canvasHeight, minHeight);
    }
    
    // Store logical dimensions (CSS pixels) for gameplay coordinates
    const logicalWidth = Math.round(canvasWidth);
    const logicalHeight = Math.round(canvasHeight);
    canvas.logicalWidth = logicalWidth;
    canvas.logicalHeight = logicalHeight;

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

        // Toggle developer panel (semicolon key)
        if (e.code === 'Semicolon' && appRuntime.devPanel?.enabled) {
            appRuntime.devPanel.toggle();
        }

        // Game pause toggle
        if (e.code === 'KeyP' && (game && game.gameState === 'playing' || game.gameState === 'paused')) {
            togglePause();
        }

        if (e.code === 'Escape') {
            // Close leaderboard if visible
            const lbEl = /** @type {any} */ (document.querySelector('leaderboard-screen'));
            if (lbEl?.isVisible()) {
                lbEl.hide();
                lbEl.dispatchEvent(new CustomEvent('leaderboard-close', { bubbles: true, composed: true }));
                return;
            }
            // Close login screen if visible
            const loginEl = /** @type {any} */ (document.querySelector('login-screen'));
            if (loginEl?.isVisible()) {
                loginEl.hide();
                loginEl.dispatchEvent(new CustomEvent('login-close', { bubbles: true, composed: true }));
                return;
            }
            const settingsModalEl = /** @type {SettingsModalElement} */ (document.querySelector('settings-modal'));
            if (settingsModalEl.isVisible()) {
                closeSettingsModal();
            } else if (game && (game.gameState === 'playing' || game.gameState === 'paused')) {
                openSettingsModal();
            }
        }

        // QERT skill casting (only when playing)
        if (game && game.gameState === 'playing') {
            const slotMap = { KeyQ: 0, KeyE: 1, KeyR: 2, KeyT: 3 };
            if (e.code in slotMap) {
                const slotIndex = slotMap[e.code];
                const slots = game.skillManager.getKeybindSlots();
                const slot = slots[slotIndex];
                if (slot?.skillId) {
                    game.castActiveSkill(slot.skillId);
                }
            }
        }
        
        // Prevent spacebar and arrow key page scrolling during gameplay
        if (e.code === 'Space' || e.code.startsWith('Arrow')) {
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
    audioManager.loadAudio();
}

/**
 * Play a sound effect by name.
 * Bridge export — delegates to AudioManager singleton.
 * @param {string} soundName - Name of the sound effect to play
 */
export function playSFX(soundName) {
    audioManager.playSFX(soundName);
}

/**
 * Legacy mute toggle helper retained for compatibility
 * Internally updates the settings manager
 */
export function toggleMute() {
    const hasAnyAudio = audioManager.soundVolume > 0 || audioManager.musicVolume > 0;
    settingsManager.update({
        soundVolume: hasAnyAudio ? 0 : 30,
        musicVolume: hasAnyAudio ? 0 : 20
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
    document.querySelector('start-screen').hide();
    document.querySelector('game-over-screen').hide();
    playSFX('ui_start_game');

    telemetry.startSession({
        entryPoint: 'start_screen',
        statsOverlayEnabled: showPerformanceStats
    });

    const selectedDifficulty = document.querySelector('start-screen').getSelectedDifficulty();
    game.setRunDifficulty(selectedDifficulty);
    syncStartDifficultyUI(selectedDifficulty);
    
    syncMusicTrack({ restart: true });
    
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
    document.querySelector('game-over-screen').hide();
    document.querySelector('victory-screen').hide();
    document.querySelector('start-screen').hide();
    playSFX('ui_restart_game');

    telemetry.track('run_restart', {
        fromWave: game.wave,
        score: game.score
    });

    game.restart();
    syncMusicTrack({ restart: true });
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
        syncMusicTrack();
        document.querySelector('pause-screen').show();
        syncSaveButtons();
    } else if (game.gameState === 'paused') {
        if (document.querySelector('settings-modal').isVisible()) {
            return;
        }
        playSFX('ui_pause_off');
        game.resume();
        syncMusicTrack();
        document.querySelector('pause-screen').hide();
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
    syncMusicTrack();
    
    // Only update and render when game is in active states or UI overlays
    if (game.gameState === 'playing' || game.gameState === 'powerup' || game.gameState === 'levelup' || game.gameState === 'ascension') {
        // Update game logic
        game.update(delta, input);
        
        // Render current frame
        game.render();
        
        // Update user interface elements
        hudManager.update();
    }
    
    // Continue loop based on game state
    if (game.gameState === 'playing' || game.gameState === 'powerup' || game.gameState === 'levelup' || game.gameState === 'ascension') {
        animationFrameId = requestAnimationFrame(gameLoop);
    } else {
        animationFrameId = null;
        if (game.gameState === 'gameover') {
            showGameOver();
        } else if (game.gameState === 'victory') {
            showVictoryScreen();
        }
    }
}

/**
 * Display game over screen with final statistics
 * Stops background music and shows final wave reached
 */
function showGameOver() {
    const goScreen = document.querySelector('game-over-screen');
    goScreen.setStats({
        wave: game.wave,
        score: game.score,
        combo: game.comboSystem.maxStreakThisRun || 0,
        level: game.level,
    });

    // Check personal bests using stored result from recordRunEnd (called before showGameOver)
    const runResult = game._lastRunResult;
    const isNewBest = !!(runResult && (runResult.isNewBestScore || runResult.isNewBestWave));
    goScreen.setNewRecord(isNewBest);

    // Near-miss psychology
    const snap = game.progressionManager.getSnapshot();
    const waveDiff = (snap.bestWave || 0) - game.wave;
    if (waveDiff > 0 && waveDiff <= 5 && !isNewBest) {
        goScreen.setNearMiss(`Only ${waveDiff} wave${waveDiff > 1 ? 's' : ''} from your best!`);
    } else {
        goScreen.setNearMiss(null);
    }

    goScreen.show();
    syncSaveButtons();

    playSFX('game_over');

    telemetry.endSession('game_over', {
        finalWave: game.wave,
        finalScore: game.score,
        finalLevel: game.level,
    });

    syncMusicTrack({ restart: true });
}

/**
 * Display victory screen after completing wave 30.
 * Shows final statistics and options to continue to endless or return to menu.
 */
function showVictoryScreen() {
    const vicScreen = document.querySelector('victory-screen');
    vicScreen.setStats({
        wave: game.wave,
        score: game.score,
        combo: game.comboSystem.maxStreakThisRun || 0,
        level: game.level,
        kills: game.achievementSystem.killsThisRun || 0,
    });

    const runResult = game._lastRunResult;
    const isNewBest = !!(runResult && (runResult.isNewBestScore || runResult.isNewBestWave));
    vicScreen.setNewRecord(isNewBest);

    vicScreen.show();

    playSFX('boss_defeat');

    telemetry.endSession('victory', {
        finalWave: game.wave,
        finalScore: game.score,
        finalLevel: game.level,
    });

    syncMusicTrack({ restart: true });
}

/**
 * Continue to endless mode after victory.
 */
function continueToEndless() {
    document.querySelector('victory-screen').hide();
    playSFX('ui_restart_game');

    game.continueToEndless();
    syncMusicTrack({ restart: true });

    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    lastTime = performance.now();
    animationFrameId = requestAnimationFrame(gameLoop);
}

/**
 * Return to menu from victory screen.
 */
function restartFromVictory() {
    document.querySelector('victory-screen').hide();
    populateLastRunStats();
    document.querySelector('start-screen').show();
    playSFX('ui_restart_game');

    syncMusicTrack({ restart: true });
    syncStartDifficultyUI(game.getRunDifficulty());
    syncSaveButtons();
}

/**
 * Populate last run stats on the start screen from progression data.
 */
function populateLastRunStats() {
    const startScreen = document.querySelector('start-screen');
    if (!startScreen || !game?.progressionManager) return;

    const snap = game.progressionManager.getSnapshot();
    const history = snap.runHistory || [];

    if (history.length === 0 && !snap.bestScore) {
        startScreen.setLastRunStats({});
        return;
    }

    const last = history.length > 0 ? history[history.length - 1] : null;
    startScreen.setLastRunStats({
        lastWave: last?.wave,
        lastScore: last?.score || 0,
        bestWave: snap.bestWave || 0,
        bestScore: snap.bestScore || 0,
    });
}

function applySettings(settings) {
    // Delegate audio volume handling to AudioManager
    audioManager.applySettings(settings);

    showPerformanceStats = settings.showPerformanceStats;
    hudManager.setPerformanceStatsVisible(showPerformanceStats);

    const settingsModalEl = document.querySelector('settings-modal');
    settingsModalEl?.setKeybindHintsVisible(settings.showKeybindHints);

    game?.setRuntimeSettings({
        screenShakeEnabled: settings.screenShakeEnabled,
        performanceModeEnabled: settings.performanceModeEnabled
    });

    if (game?.performanceManager) {
        game.performanceManager.forcedPerformanceMode = settings.performanceModeEnabled;
    }

    settingsModalEl?.updateUI(settings);
}

function handleSettingChange(e) {
    const { key, value } = e.detail;
    const next = settingsManager.update({ [key]: value });
    applySettings(next);
}

function openSettingsModal() {
    const settingsModalEl = document.querySelector('settings-modal');
    settingsModalEl.updateUI(settingsManager.getSettings());
    syncSaveButtons();
    settingsModalWasPlaying = game?.gameState === 'playing';

    if (settingsModalWasPlaying) {
        game.pause();
        syncMusicTrack();
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    settingsModalEl.show();
}

function closeSettingsModal() {
    document.querySelector('settings-modal').hide();

    if (settingsModalWasPlaying && game?.gameState === 'paused') {
        game.resume();
        syncMusicTrack();
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
        }
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    settingsModalWasPlaying = false;
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
    document.querySelector('start-screen').hide();
    document.querySelector('game-over-screen').hide();
    document.querySelector('pause-screen').hide();
    document.querySelector('settings-modal').hide();

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

    syncMusicTrack();

    syncStartDifficultyUI(game.getRunDifficulty());

    settingsModalWasPlaying = false;
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

    document.querySelector('settings-modal')?.setSaveButtonStates({ hasSave });
    document.querySelector('game-over-screen')?.setLoadSaveVisible(hasSave);
}

function syncStartDifficultyUI(difficulty = game?.getRunDifficulty()) {
    document.querySelector('start-screen')?.setDifficulty(difficulty ?? 'normal');
}

function resetSettingsToDefaults() {
    const defaults = settingsManager.resetToDefaults();
    applySettings(defaults);
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
