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
import { vfxHelper } from './managers/VFXHelper.js';
import { hudManager } from './managers/HUDManager.js';
import { skillUI } from './ui/SkillUIController.js';
import { DevPanel } from './ui/DevPanel.js';

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

function getInputElement(id) {
    return /** @type {HTMLInputElement} */ (document.getElementById(id));
}

function getButtonElement(id) {
    return /** @type {HTMLButtonElement} */ (document.getElementById(id));
}

function clampSettingVolume(value, fallback = 0) {
    if (!Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(0, Math.min(100, Math.round(value)));
}

function updateVolumeValueLabel(labelId, value) {
    const valueLabel = document.getElementById(labelId);
    if (!valueLabel) {
        return;
    }

    valueLabel.textContent = clampSettingVolume(value, 0).toString();
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
    document.getElementById('startScreen').classList.add('show');

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
    document.getElementById('continueEndlessBtn').addEventListener('click', continueToEndless);
    document.getElementById('victoryRestartBtn').addEventListener('click', restartFromVictory);

    // Show Admin Panel button in settings if ?dev=true
    if (appRuntime.devPanel?.enabled) {
        const devRow = document.getElementById('devPanelSettingsRow');
        if (devRow) devRow.style.display = '';
        document.getElementById('devPanelToggleBtn')?.addEventListener('click', () => {
            appRuntime.devPanel.toggle();
            closeSettingsModal();
        });
    }

    setupSettingsControls();
    setupStartDifficultyControls();
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

        if (e.code === 'Escape' && document.getElementById('settingsModal').classList.contains('show')) {
            closeSettingsModal();
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
    document.getElementById('startScreen').classList.remove('show');
    document.getElementById('gameOver').classList.remove('show');
    playSFX('ui_start_game');

    telemetry.startSession({
        entryPoint: 'start_screen',
        statsOverlayEnabled: showPerformanceStats
    });

    const selectedDifficulty = getSelectedStartDifficulty();
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
    document.getElementById('gameOver').classList.remove('show');
    document.getElementById('victoryScreen').classList.remove('show');
    document.getElementById('startScreen').classList.remove('show');
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
        document.getElementById('pauseScreen').classList.add('show');
        syncSaveButtons();
    } else if (game.gameState === 'paused') {
        if (document.getElementById('settingsModal').classList.contains('show')) {
            return;
        }
        playSFX('ui_pause_off');
        game.resume();
        syncMusicTrack();
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
    // Populate enhanced game over stats
    document.getElementById('finalWave').textContent = game.wave.toString();
    document.getElementById('finalScore').textContent = game.score.toLocaleString();
    document.getElementById('finalCombo').textContent = (game.comboSystem.maxStreakThisRun || 0).toString();
    document.getElementById('finalLevel').textContent = game.level.toString();

    // Check personal bests using stored result from recordRunEnd (called before showGameOver)
    const runResult = game._lastRunResult;
    const isNewBest = !!(runResult && (runResult.isNewBestScore || runResult.isNewBestWave));
    const newRecordBanner = document.getElementById('newRecordBanner');
    if (newRecordBanner) {
        newRecordBanner.style.display = isNewBest ? 'block' : 'none';
    }

    // Near-miss psychology - use snapshot (bests are already updated, so compare directly)
    const nearMissInfo = document.getElementById('nearMissInfo');
    if (nearMissInfo) {
        const snap = game.progressionManager.getSnapshot();
        // bestWave is now updated; if NOT a new best, show how close we were
        const waveDiff = (snap.bestWave || 0) - game.wave;
        if (waveDiff > 0 && waveDiff <= 5 && !isNewBest) {
            nearMissInfo.style.display = 'block';
            nearMissInfo.textContent = `Only ${waveDiff} wave${waveDiff > 1 ? 's' : ''} from your best!`;
        } else {
            nearMissInfo.style.display = 'none';
        }
    }

    document.getElementById('gameOver').classList.add('show');
    syncSaveButtons();

    const hasSave = saveStateManager.hasSave();
    document.getElementById('loadAfterGameOverBtn').style.display = hasSave ? 'inline-block' : 'none';

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
    document.getElementById('victoryWave').textContent = game.wave.toString();
    document.getElementById('victoryScore').textContent = game.score.toLocaleString();
    document.getElementById('victoryCombo').textContent = (game.comboSystem.maxStreakThisRun || 0).toString();
    document.getElementById('victoryLevel').textContent = game.level.toString();
    document.getElementById('victoryKills').textContent = (game.achievementSystem.killsThisRun || 0).toString();

    const runResult = game._lastRunResult;
    const isNewBest = !!(runResult && (runResult.isNewBestScore || runResult.isNewBestWave));
    const newRecordBanner = document.getElementById('victoryNewRecord');
    if (newRecordBanner) {
        newRecordBanner.style.display = isNewBest ? 'block' : 'none';
    }

    document.getElementById('victoryScreen').classList.add('show');

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
    document.getElementById('victoryScreen').classList.remove('show');
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
    document.getElementById('victoryScreen').classList.remove('show');
    populateLastRunStats();
    document.getElementById('startScreen').classList.add('show');
    playSFX('ui_restart_game');

    syncMusicTrack({ restart: true });
    syncStartDifficultyUI(game.getRunDifficulty());
    syncSaveButtons();
}

/**
 * Populate last run stats on the start screen from progression data.
 */
function populateLastRunStats() {
    const container = document.getElementById('lastRunStats');
    if (!container || !game?.progressionManager) return;

    const snap = game.progressionManager.getSnapshot();
    const history = snap.runHistory || [];

    if (history.length === 0 && !snap.bestScore) {
        container.style.display = 'none';
        return;
    }

    // Last run
    if (history.length > 0) {
        const last = history[history.length - 1];
        document.getElementById('lastRunWave').textContent = last.wave.toString();
        document.getElementById('lastRunScore').textContent = (last.score || 0).toLocaleString();
    }

    // Best ever
    document.getElementById('bestWave').textContent = (snap.bestWave || 0).toString();
    document.getElementById('bestScore').textContent = (snap.bestScore || 0).toLocaleString();

    container.style.display = 'block';
}

function applySettings(settings) {
    // Delegate audio volume handling to AudioManager
    audioManager.applySettings(settings);

    showPerformanceStats = settings.showPerformanceStats;
    hudManager.setPerformanceStatsVisible(showPerformanceStats);

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
    const soundSliderValue = clampSettingVolume(settings.soundVolume, 30);
    const musicSliderValue = clampSettingVolume(settings.musicVolume, 20);

    getInputElement('settingSoundVolume').value = soundSliderValue.toString();
    getInputElement('settingMusicVolume').value = musicSliderValue.toString();
    updateVolumeValueLabel('settingSoundVolumeValue', soundSliderValue);
    updateVolumeValueLabel('settingMusicVolumeValue', musicSliderValue);
    getInputElement('settingScreenShake').checked = settings.screenShakeEnabled;
    getInputElement('settingPerformanceMode').checked = settings.performanceModeEnabled;
    getInputElement('settingShowStats').checked = settings.showPerformanceStats;
    getInputElement('settingKeybindHints').checked = settings.showKeybindHints;
}

function setupSettingsControls() {
    document.getElementById('settingSoundVolume').addEventListener('input', (event) => {
        const target = /** @type {HTMLInputElement} */ (event.currentTarget);
        const volume = clampSettingVolume(Number.parseInt(target.value, 10), 30);
        const next = settingsManager.update({ soundVolume: volume });
        updateVolumeValueLabel('settingSoundVolumeValue', volume);
        applySettings(next);
    });

    document.getElementById('settingMusicVolume').addEventListener('input', (event) => {
        const target = /** @type {HTMLInputElement} */ (event.currentTarget);
        const volume = clampSettingVolume(Number.parseInt(target.value, 10), 20);
        const next = settingsManager.update({ musicVolume: volume });
        updateVolumeValueLabel('settingMusicVolumeValue', volume);
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
        syncMusicTrack();
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
        syncMusicTrack();
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

function resetSettingsToDefaults() {
    const defaults = settingsManager.resetToDefaults();
    applySettings(defaults);
}

/** @deprecated Import from managers/VFXHelper.js instead */
export function createFloatingText(text, x, y, className = 'damage') {
    vfxHelper.createFloatingText(text, x, y, className);
}

/** @deprecated Import from managers/VFXHelper.js instead */
export function screenFlash() {
    vfxHelper.screenFlash();
}

/** @deprecated Import from ui/SkillUIController.js instead */
export function showLevelUpPanel() { skillUI.showLevelUpPanel(); }

/** @deprecated Import from ui/SkillUIController.js instead */
export function showAscensionPanel() { skillUI.showAscensionPanel(); }

/** @deprecated Import from ui/SkillUIController.js instead */
export function closeAllSkillOverlays() { skillUI.closeAll(); }

// Initialize application when DOM content is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
    setTimeout(init, 0);
}

window.addEventListener('beforeunload', () => {
    telemetry.endSession('window_unload');
});
