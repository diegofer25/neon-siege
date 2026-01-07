/**
 * @fileoverview Main game entry point and application controller
 * Handles game initialization, input management, audio system, UI updates, and game loop
 * 
 */

import { Game } from './Game.js';

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

/**
 * Audio system configuration and state
 * @type {Object}
 * @property {HTMLAudioElement|null} bgm - Background music element
 * @property {Object} sfx - Sound effect audio elements
 * @property {boolean} enabled - Global audio enable/disable flag
 */
const audio = {
    bgm: null,
    sfx: {
        shoot: null,
        explode: null,
        hurt: null,
        powerup: null,
        click: null
    },
    enabled: true
};

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

//=============================================================================
// INITIALIZATION AND SETUP
//=============================================================================

/**
 * Initialize the game application
 * Sets up canvas, game instance, input handlers, audio, and UI
 */
function init() {
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
    
    // Restore user audio preferences from localStorage
    if (localStorage.getItem('mute') === 'true') {
        toggleMute();
    }

    // Check for performance stats URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    showPerformanceStats = urlParams.get('stats') === 'true';
    
    if (showPerformanceStats) {
        document.getElementById('performanceStats').style.display = 'flex';
    }

    // Display initial start screen
    document.getElementById('startScreen').classList.add('show');

    // Listen for start button click to begin game
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('restartBtn').addEventListener('click', restartGame);
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
    const targetAspectRatio = 4/3; // 800/600 = 4/3
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const containerAspectRatio = containerWidth / containerHeight;
    
    let canvasWidth, canvasHeight;
    
    // Calculate optimal canvas size based on container aspect ratio
    if (containerAspectRatio > targetAspectRatio) {
        // Container is wider, fit to height with more generous scaling for mobile
        const mobileScale = containerWidth <= 480 ? 0.98 : 0.95;
        canvasHeight = Math.min(containerHeight * mobileScale, 600);
        canvasWidth = canvasHeight * targetAspectRatio;
    } else {
        // Container is taller, fit to width with more generous scaling for mobile
        const mobileScale = containerWidth <= 480 ? 0.98 : 0.95;
        canvasWidth = Math.min(containerWidth * mobileScale, 800);
        canvasHeight = canvasWidth / targetAspectRatio;
    }
    
    // Ensure minimum playable size on small screens
    const minWidth = 320;
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
        if (game) {
            setupCanvas();
            // Notify game of canvas size changes
            game.updateCanvasSize();
        }
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
        
        // Prevent spacebar page scrolling
        if (e.code === 'Space') {
            e.preventDefault();
        }
    });

    document.addEventListener('keyup', (e) => {
        input.keys[e.code] = false;
    });

    // Audio mute toggle button
    document.getElementById('muteBtn').addEventListener('click', toggleMute);

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
    audio.bgm = new Audio();
    audio.bgm.loop = true;
    audio.bgm.volume = 0.3;
    
    // Initialize sound effect audio elements
    Object.keys(audio.sfx).forEach(key => {
        audio.sfx[key] = new Audio();
        audio.sfx[key].volume = 0.5;
    });
    
    // Note: In production, load actual audio files here
    // For demo purposes, audio files are skipped
}

/**
 * Play a sound effect by name
 * @param {string} soundName - Name of the sound effect to play
 */
export function playSFX(soundName) {
    if (!audio.enabled || !audio.sfx[soundName]) return;
    
    try {
        // Clone audio node to allow overlapping sounds
        const sound = audio.sfx[soundName].cloneNode();
        sound.play().catch(e => console.log('Audio play failed:', e));
    } catch (e) {
        console.log('Audio error:', e);
    }
}

/**
 * Toggle audio mute state and update UI
 * Saves preference to localStorage for persistence
 */
export function toggleMute() {
    audio.enabled = !audio.enabled;
    const muteBtn = document.getElementById('muteBtn');
    
    if (audio.enabled) {
        muteBtn.textContent = '🔊';
        if (audio.bgm) audio.bgm.volume = 0.3;
    } else {
        muteBtn.textContent = '🔇';
        if (audio.bgm) audio.bgm.volume = 0;
    }
    
    // Persist mute preference
    localStorage.setItem('mute', JSON.stringify(!audio.enabled));
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
    
    // Start background music if audio is enabled
    if (audio.enabled && audio.bgm) {
        audio.bgm.play().catch(e => console.log('BGM play failed:', e));
    }
    
    // Initialize game state and start main loop
    game.start();
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
    game.restart();
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
        game.pause();
        document.getElementById('pauseScreen').classList.add('show');
    } else if (game.gameState === 'paused') {
        game.resume();
        document.getElementById('pauseScreen').classList.remove('show');
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(gameLoop);
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
    
    // Stop and reset background music
    if (audio.bgm) {
        audio.bgm.pause();
        audio.bgm.currentTime = 0;
    }
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
document.addEventListener('DOMContentLoaded', init);
