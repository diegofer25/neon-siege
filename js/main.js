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
 * @property {number} soundVolume - Sound effects volume (0.0 to 1.0)
 * @property {number} musicVolume - Music volume (0.0 to 1.0)
 */
const audio = {
    bgm: null,
    currentMusicKey: null,
    sfx: {},
    soundVolume: GameConfig.AUDIO.SFX_VOLUME,
    musicVolume: GameConfig.AUDIO.BGM_VOLUME
};

const SFX_VARIANTS = 1;

const SFX_ALIASES = {
    shoot: 'player_shoot_basic',
    explode: 'enemy_death',
    hurt: 'player_hurt',
    powerup: 'ui_purchase_success',
    click: 'ui_click'
};

const MUSIC_TRACKS = {
    music_menu_main: { src: 'assets/audio/music/music_menu_main.mp3', loop: true },
    music_menu_settings: { src: 'assets/audio/music/music_menu_settings.mp3', loop: true },
    music_menu_consent: { src: 'assets/audio/music/music_menu_consent.mp3', loop: true },
    music_run_wave_early: { src: 'assets/audio/music/music_run_wave_early.mp3', loop: true },
    music_run_wave_mid: { src: 'assets/audio/music/music_run_wave_mid.mp3', loop: true },
    music_run_wave_late: { src: 'assets/audio/music/music_run_wave_late.mp3', loop: true },
    music_wave_countdown_stinger: { src: 'assets/audio/music/music_wave_countdown_stinger.mp3', loop: false },
    music_shop_between_waves: { src: 'assets/audio/music/music_shop_between_waves.mp3', loop: true },
    music_boss_classic: { src: 'assets/audio/music/music_boss_classic.mp3', loop: true },
    music_boss_shield: { src: 'assets/audio/music/music_boss_shield.mp3', loop: true },
    music_pause_overlay: { src: 'assets/audio/music/music_pause_overlay.mp3', loop: true },
    music_gameover_defeat: { src: 'assets/audio/music/music_gameover_defeat.mp3', loop: false },
    music_restore_resume_stinger: { src: 'assets/audio/music/music_restore_resume_stinger.mp3', loop: false },
    music_run_resume_stinger: { src: 'assets/audio/music/music_run_resume_stinger.mp3', loop: false }
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

function getWaveMusicKey(wave = 1) {
    if (wave >= 31) return 'music_run_wave_late';
    if (wave >= 11) return 'music_run_wave_mid';
    return 'music_run_wave_early';
}

function resolveMusicKeyForState() {
    if (!game) return 'music_menu_main';

    if (game.gameState === 'gameover') return 'music_gameover_defeat';
    if (game.gameState === 'paused') return 'music_pause_overlay';
    if (game.gameState === 'powerup') return 'music_shop_between_waves';

    if (game.gameState === 'playing') {
        if (game.waveManager?.isBossWave) {
            return game.wave % 20 === 0 ? 'music_boss_shield' : 'music_boss_classic';
        }
        return getWaveMusicKey(game.wave);
    }

    return 'music_menu_main';
}

function shouldPlayMusicForState() {
    if (!game) return false;
    return ['menu', 'playing', 'powerup', 'paused', 'gameover'].includes(game.gameState);
}

function syncMusicTrack({ restart = false } = {}) {
    const desiredKey = resolveMusicKeyForState();
    const nextTrack = MUSIC_TRACKS[desiredKey];
    if (!nextTrack) {
        return;
    }

    if (!audio.bgm) {
        return;
    }

    if (audio.currentMusicKey === desiredKey) {
        if (restart) {
            audio.bgm.currentTime = 0;
        }
        if (audio.musicVolume > 0 && shouldPlayMusicForState() && audio.bgm.paused) {
            audio.bgm.play().catch(() => {});
        }
        return;
    }

    audio.bgm.pause();
    audio.bgm.currentTime = 0;

    audio.currentMusicKey = desiredKey;
    audio.bgm.src = nextTrack.src;
    audio.bgm.loop = nextTrack.loop;

    if (restart) {
        audio.bgm.currentTime = 0;
    }

    audio.bgm.volume = Math.max(0, Math.min(1, audio.musicVolume));

    if (audio.musicVolume > 0 && shouldPlayMusicForState()) {
        audio.bgm.play().catch(() => {});
    }
}

function setupAudioUnlockHooks() {
    const unlockAudio = () => {
        if (audio.musicVolume <= 0) {
            return;
        }
        syncMusicTrack();
    };

    document.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
    document.addEventListener('keydown', unlockAudio, { once: true });
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

function sliderValueToUnit(value, fallback = 0) {
    return clampSettingVolume(value, Math.round(fallback * 100)) / 100;
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

        // QWER skill casting (only when playing)
        if (game && game.gameState === 'playing') {
            const slotMap = { KeyQ: 0, KeyW: 1, KeyE: 2, KeyR: 3 };
            if (e.code in slotMap) {
                const slotIndex = slotMap[e.code];
                const slots = game.skillManager.getKeybindSlots();
                const slot = slots[slotIndex];
                if (slot?.skillId) {
                    game.skillManager.tryCast(slot.skillId);
                }
            }
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
    audio.bgm = new Audio(MUSIC_TRACKS.music_menu_main.src);
    audio.bgm.preload = 'auto';
    audio.bgm.loop = MUSIC_TRACKS.music_menu_main.loop;
    audio.bgm.volume = Math.max(0, Math.min(1, audio.musicVolume));
    audio.currentMusicKey = 'music_menu_main';

    // Initialize sound effect audio variants from manifest-generated files
    audio.sfx = {};
    SOUND_EFFECT_MANIFEST.forEach(({ key }) => {
        const variants = [];
        for (let variant = 1; variant <= SFX_VARIANTS; variant += 1) {
            const sound = new Audio(`assets/audio/sfx/${key}_v${variant}.mp3`);
            sound.preload = 'auto';
            sound.volume = audio.soundVolume;
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
    if (audio.soundVolume <= 0) return;

    const canonicalName = SFX_ALIASES[soundName] || soundName;
    const pool = audio.sfx[canonicalName];
    if (!pool || pool.length === 0) return;
    
    try {
        const source = pool[0];
        // Clone audio node to allow overlapping sounds
        const sound = source.cloneNode();
        sound.volume = Math.max(0, Math.min(1, GameConfig.AUDIO.SFX_VOLUME * audio.soundVolume));
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
    const hasAnyAudio = audio.soundVolume > 0 || audio.musicVolume > 0;
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
    document.getElementById('startScreen').classList.remove('show');
    playSFX('ui_restart_game');
    adRestoreConsumedThisGameOver = false;

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
    
    if (game.player.hasShield) {
        // Player has shield - show defense bar
        defenseBarElement.style.display = 'block';
        
        // Update defense bar visualization
        const currentDefense = game.player.shieldHp;
        const maxDefense = game.player.maxShieldHp;
        const defensePercentage = maxDefense > 0 ? Math.max(0, (currentDefense / maxDefense) * 100) : 0;
        document.getElementById('defenseFill').style.width = defensePercentage.toFixed(1) + '%';
        document.getElementById('defenseText').textContent = `${Math.max(0, Math.floor(currentDefense))}/${Math.floor(maxDefense)}`;
    } else {
        // Player doesn't have shield - hide defense bar
        defenseBarElement.style.display = 'none';
    }
    
    // Update wave progress with enemy count using wave manager data
    const waveProgress = game.getWaveProgress();
    const remainingEnemies = game.enemies.length + waveProgress.enemiesToSpawn;
    document.getElementById('wave').textContent = `Wave: ${game.wave} (${remainingEnemies}/${waveProgress.totalEnemies})`;
    
    // Refresh player statistics display
    updateStatsDisplay();

    // Update score display
    const scoreValueEl = document.getElementById('scoreValue');
    if (scoreValueEl) scoreValueEl.textContent = game.score.toLocaleString();
    const scoreMultiplierEl = document.getElementById('scoreMultiplier');
    if (scoreMultiplierEl) {
        const mult = game.comboSystem.getScoreMultiplier();
        if (mult > 1) {
            scoreMultiplierEl.style.display = 'inline';
            scoreMultiplierEl.textContent = `x${mult.toFixed(1)}`;
        } else {
            scoreMultiplierEl.style.display = 'none';
        }
    }

    // Update XP bar (delegated to SkillManager)
    const xpFill = document.getElementById('xpFill');
    const xpLevel = document.getElementById('xpLevel');
    if (xpFill && game.skillManager) xpFill.style.width = ((game.skillManager.xp / game.skillManager.xpToNextLevel) * 100).toFixed(1) + '%';
    if (xpLevel && game.skillManager) xpLevel.textContent = `Lv.${game.skillManager.level}`;

    // Update combo counter
    const comboCounter = document.getElementById('comboCounter');
    if (comboCounter) {
        const tierInfo = game.comboSystem.getCurrentTierInfo();
        if (tierInfo && game.comboSystem.currentStreak >= 5) {
            comboCounter.style.display = 'flex';
            document.getElementById('comboLabel').textContent = tierInfo.label;
            document.getElementById('comboCount').textContent = game.comboSystem.currentStreak.toString();
            document.getElementById('comboTimerFill').style.width = (game.comboSystem.getTimerProgress() * 100) + '%';
            comboCounter.style.borderColor = tierInfo.color;
            document.getElementById('comboLabel').style.color = tierInfo.color;
            document.getElementById('comboCount').style.color = tierInfo.color;
            document.getElementById('comboTimerFill').style.background = tierInfo.color;
        } else {
            comboCounter.style.display = 'none';
        }
    }

    // Update challenge display
    const challengeDisplay = document.getElementById('challengeDisplay');
    if (challengeDisplay && game.challengeSystem.activeChallenges.length > 0) {
        challengeDisplay.style.display = 'block';
        challengeDisplay.innerHTML = game.challengeSystem.activeChallenges.map(c => {
            const cls = c.completed ? 'challenge-item completed' : 'challenge-item';
            return `<div class="${cls}"><span class="challenge-icon">${c.icon}</span><span class="challenge-progress">${c.progress}/${c.target}</span></div>`;
        }).join('');
    }

    // Update QWER skill slot bar
    if (game.skillManager) {
        const slots = game.skillManager.getKeybindSlots();
        for (let i = 0; i < 4; i++) {
            const nameEl = document.getElementById(`skillName${i}`);
            const cdEl = document.getElementById(`skillCd${i}`);
            const slotEl = nameEl?.closest('.skill-slot');
            const slot = slots[i];
            if (!nameEl || !cdEl) continue;
            if (slot?.skillId && slot.skill) {
                nameEl.textContent = slot.skill.name.substring(0, 8);
                const cd = game.skillManager.cooldowns[slot.skillId];
                if (cd && cd > 0) {
                    const maxCd = game.skillManager.getCooldownInfo(slot.skillId).total;
                    cdEl.style.height = ((cd / maxCd) * 100).toFixed(0) + '%';
                    slotEl?.classList.add('on-cooldown');
                } else {
                    cdEl.style.height = '0%';
                    slotEl?.classList.remove('on-cooldown');
                }
            } else {
                nameEl.textContent = i === 3 ? '🔒' : '—';
                cdEl.style.height = '0%';
            }
        }

        for (let i = 0; i < SKILL_SLOTS.PASSIVE_MAX; i++) {
            const nameEl = document.getElementById(`passiveName${i}`);
            const slotEl = nameEl?.closest('.passive-slot');
            if (!nameEl || !slotEl) continue;

            const skillId = game.skillManager.equippedPassives[i] || null;
            if (!skillId) {
                nameEl.textContent = '—';
                slotEl.classList.remove('filled');
                continue;
            }

            const skill = game.skillManager.getSkillDef(skillId);
            const rank = game.skillManager.getSkillRank(skillId);
            if (!skill) {
                nameEl.textContent = '—';
                slotEl.classList.remove('filled');
                continue;
            }

            nameEl.textContent = `${skill.icon || '✨'} ${rank}`;
            slotEl.classList.add('filled');
        }
    }

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
    const hpsValue = game.player.hpRegen;
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
    document.getElementById('restoreFromAdBtn').style.display = hasSave && !adRestoreConsumedThisGameOver ? 'inline-block' : 'none';

    playSFX('game_over');

    telemetry.endSession('game_over', {
        finalWave: game.wave,
        finalScore: game.score,
        finalLevel: game.level,
    });

    syncMusicTrack({ restart: true });
}

function applySettings(settings) {
    const soundSliderValue = clampSettingVolume(settings.soundVolume, 30);
    const musicSliderValue = clampSettingVolume(settings.musicVolume, 20);
    audio.soundVolume = sliderValueToUnit(soundSliderValue, GameConfig.AUDIO.SFX_VOLUME);
    audio.musicVolume = sliderValueToUnit(musicSliderValue, GameConfig.AUDIO.BGM_VOLUME);

    if (audio.bgm) {
        audio.bgm.volume = Math.max(0, Math.min(1, audio.musicVolume));
        if (audio.musicVolume > 0) {
            if (shouldPlayMusicForState() && audio.bgm.paused) {
                audio.bgm.play().catch(() => {});
            }
        } else {
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

//=============================================================================
// SKILL UI RENDERING
//=============================================================================
import { ARCHETYPES, PLAYABLE_ARCHETYPES, SKILL_SLOTS } from './config/SkillConfig.js';
import { SkillTreeRenderer } from './ui/SkillTreeRenderer.js';

/** @type {SkillTreeRenderer|null} */
let treeRenderer = null;
/** @type {ReturnType<import('./managers/SkillManager.js').SkillManager['getSaveState']>|null} */
let levelUpPanelSnapshot = null;

function _areArraysEqual(a = [], b = []) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function _isObjectShallowEqual(a = {}, b = {}) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
        if (a[key] !== b[key]) return false;
    }
    return true;
}

function _hasLevelUpSelectionChanges(sm) {
    if (!levelUpPanelSnapshot) return false;

    return !(
        _isObjectShallowEqual(sm.attributes, levelUpPanelSnapshot.attributes) &&
        _isObjectShallowEqual(sm.skillRanks, levelUpPanelSnapshot.skillRanks) &&
        _isObjectShallowEqual(sm.treeInvestment, levelUpPanelSnapshot.treeInvestment) &&
        _areArraysEqual(sm.equippedPassives, levelUpPanelSnapshot.equippedPassives) &&
        _areArraysEqual(sm.equippedActives, levelUpPanelSnapshot.equippedActives) &&
        sm.equippedUltimate === levelUpPanelSnapshot.equippedUltimate &&
        sm.unspentSkillPoints === levelUpPanelSnapshot.unspentSkillPoints &&
        sm.unspentAttributePoints === levelUpPanelSnapshot.unspentAttributePoints
    );
}

function _updateLevelUpActionButtons(sm) {
    const resetBtn = document.getElementById('levelUpResetBtn');
    const confirmBtn = document.getElementById('levelUpConfirmBtn');
    if (!resetBtn || !confirmBtn) return;

    const hasChanges = _hasLevelUpSelectionChanges(sm);
    const hasUnspentPoints = sm.unspentAttributePoints > 0 || sm.unspentSkillPoints > 0;

    resetBtn.disabled = !hasChanges;
    confirmBtn.disabled = hasUnspentPoints;
}

/**
 * Show level-up panel (between waves or mid-wave).
 * Renders the full PoE-style skill tree.
 */
export function showLevelUpPanel() {
    if (!game || !game.skillManager) return;
    const sm = game.skillManager;
    const panel = document.getElementById('levelUpPanel');
    const titleEl = document.getElementById('levelUpTitle');
    levelUpPanelSnapshot = sm.getSaveState();
    titleEl.textContent = `LEVEL ${sm.level}!`;

    // Update point badges
    document.getElementById('attrPointsLeft').textContent = sm.unspentAttributePoints;
    document.getElementById('skillPointsLeft').textContent = sm.unspentSkillPoints;

    // Render the skill tree
    const viewport = document.getElementById('skillTreeViewport');
    if (!treeRenderer) {
        treeRenderer = new SkillTreeRenderer(viewport);
    }
    treeRenderer.setCallbacks(
        (skillId) => {
            sm.learnSkill(skillId);
            _refreshTree(sm);
            playSFX('ui_purchase_success');
        },
        (attrKey) => {
            if (sm.allocateAttribute(attrKey)) {
                _refreshTree(sm);
            }
        },
    );
    treeRenderer.render(sm);

    const resetBtn = document.getElementById('levelUpResetBtn');
    const confirmBtn = document.getElementById('levelUpConfirmBtn');
    if (resetBtn) {
        resetBtn.onclick = () => {
            if (!levelUpPanelSnapshot) return;
            sm.restoreFromSave(levelUpPanelSnapshot);
            _refreshTree(sm);
            playSFX('ui_click');
        };
    }
    confirmBtn.onclick = () => {
        if (confirmBtn.disabled) return;
        levelUpPanelSnapshot = null;
        panel.classList.remove('show');
        if (game.gameState === 'levelup') {
            game.completeMidWaveLevelUp();
        } else {
            game.continueToNextWave();
        }
    };

    panel.classList.add('show');
    _updateLevelUpActionButtons(sm);
}

/** Refresh tree + point badges after spending a point. */
function _refreshTree(sm) {
    document.getElementById('attrPointsLeft').textContent = sm.unspentAttributePoints;
    document.getElementById('skillPointsLeft').textContent = sm.unspentSkillPoints;
    if (treeRenderer) treeRenderer.update(sm);
    _updateLevelUpActionButtons(sm);
}

/**
 * Show archetype selection panel (first boss wave).
 */
export function showArchetypeSelectPanel() {
    if (!game || !game.skillManager) return;
    const container = document.getElementById('archetypeOptions');
    container.innerHTML = '';

    for (const key of PLAYABLE_ARCHETYPES) {
        const archetype = ARCHETYPES[key];
        if (!archetype) continue;
        const card = document.createElement('div');
        card.className = 'archetype-card';
        card.style.setProperty('--arch-color', archetype.color);
        card.innerHTML = `
            <div class="archetype-icon">${archetype.icon || '🎯'}</div>
            <div class="archetype-name">${archetype.label}</div>
            <div class="archetype-desc">${archetype.description || ''}</div>
        `;
        card.onclick = () => {
            game.selectArchetype(key);
            document.getElementById('archetypeSelectPanel').classList.remove('show');
            playSFX('ui_purchase_success');
        };
        container.appendChild(card);
    }

    document.getElementById('archetypeSelectPanel').classList.add('show');
}

/**
 * Show ascension pick panel (every 10 waves).
 */
export function showAscensionPanel() {
    if (!game || !game.ascensionSystem) return;
    const options = game.ascensionSystem.generateOptions();
    const container = document.getElementById('ascensionOptions');
    container.innerHTML = '';

    for (const mod of options) {
        const card = document.createElement('div');
        card.className = 'ascension-card';
        card.innerHTML = `
            <div class="ascension-icon">${mod.icon || '✨'}</div>
            <div class="ascension-name">${mod.name}</div>
            <div class="ascension-desc">${mod.description}</div>
        `;
        card.onclick = () => {
            game.selectAscension(mod.id);
            document.getElementById('ascensionPanel').classList.remove('show');
            playSFX('ui_purchase_success');
        };
        container.appendChild(card);
    }

    document.getElementById('ascensionPanel').classList.add('show');
}

/**
 * Close all skill-related overlays
 */
export function closeAllSkillOverlays() {
    document.getElementById('levelUpPanel')?.classList.remove('show');
    document.getElementById('archetypeSelectPanel')?.classList.remove('show');
    document.getElementById('ascensionPanel')?.classList.remove('show');
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
