/**
 * @fileoverview Performance monitoring and optimization manager
 * 
 * This module provides real-time performance monitoring and automatic optimization
 * adjustments for the tower defense game. It tracks FPS, frame times, and
 * automatically enables/disables visual optimizations based on performance thresholds.
 * 
 * @module PerformanceManager
 */

/**
 * Manages game performance monitoring and automatic optimization adjustments.
 * 
 * The PerformanceManager continuously monitors frame rate and adjusts visual
 * effects to maintain smooth gameplay. It uses a tiered optimization approach:
 * - Normal performance: All effects enabled
 * - Low performance: Basic optimizations (particle reduction)
 * - Critical performance: Aggressive optimizations (trails disabled, heavy particle reduction)
 * 
 * @class PerformanceManager
 * @example
 * const perfManager = new PerformanceManager();
 * 
 * // In game loop
 * perfManager.update(deltaTime);
 * if (perfManager.needsOptimization()) {
 *     // Apply optimizations based on perfManager.getStats()
 * }
 */
export class PerformanceManager {
    /**
     * Initialize performance monitoring with default settings.
     * 
     * Sets up FPS tracking, optimization thresholds, and performance history.
     * All optimization flags start as disabled (false).
     */
    constructor() {
        /** @type {number} Current frame delta time in milliseconds */
        this.frameTime = 0;
        
        /** @type {number} Current frames per second */
        this.fps = 60;
        
        /** @type {number} Frame counter for FPS calculation */
        this.frameCount = 0;
        
        /** @type {number} Timestamp of last FPS update in milliseconds */
        this.lastFpsUpdate = 0;
        
        /** @type {number[]} Historical FPS values for trend analysis */
        this.fpsHistory = [];
        
        /** @type {number} Maximum number of FPS samples to retain */
        this.maxHistory = 60;
        
        // Performance thresholds for optimization triggers
        /** @type {number} FPS threshold below which basic optimizations are enabled */
        this.lowFpsThreshold = 30;
        
        /** @type {number} FPS threshold below which aggressive optimizations are enabled */
        this.criticalFpsThreshold = 15;
        
        // Optimization control flags
        /** @type {boolean} Whether to optimize particle effects */
        this.enableParticleOptimization = false;
        
        /** @type {boolean} Whether to optimize or disable trail effects */
        this.enableTrailOptimization = false;
        
        /** @type {boolean} Whether to significantly reduce particle counts */
        this.reduceParticleCount = false;

        /** @type {boolean} Whether performance mode is manually forced by user settings */
        this.forcedPerformanceMode = false;
    }
    
    /**
     * Update performance metrics and optimization flags based on current frame.
     * 
     * Should be called once per frame in the main game loop. Updates FPS calculations
     * every second and adjusts optimization flags based on performance trends.
     * 
     * @param {number} deltaTime - Time elapsed since last frame in milliseconds
     * @param {string} [gameState] - Current game state to optimize tracking
     * @example
     * // In main game loop
     * const deltaTime = now - lastTime;
     * performanceManager.update(deltaTime, game.gameState);
     */
    update(deltaTime, gameState = 'playing') {
        this.frameTime = deltaTime;
        this.frameCount++;
        
        // Calculate FPS every second to avoid excessive computation
        const now = performance.now();
        if (now - this.lastFpsUpdate >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = now;
            
            // Maintain rolling window of FPS history for trend analysis
            this.fpsHistory.push(this.fps);
            if (this.fpsHistory.length > this.maxHistory) {
                this.fpsHistory.shift(); // Remove oldest sample
            }
            
            // Only reassess optimization needs when game is actively playing
            if (gameState === 'playing') {
                this.updateOptimizationFlags();
            }
        }
    }
    
    /**
     * Update optimization flags based on recent average performance.
     * 
     * Uses a tiered approach to optimization:
     * - Critical performance (< 15 FPS): Enable all optimizations
     * - Low performance (< 30 FPS): Enable basic particle optimization only
     * - Good performance (≥ 30 FPS): Disable all optimizations
     * 
     * This method is called automatically by update() when FPS is recalculated.
     * 
     * @private
     */
    updateOptimizationFlags() {
        if (this.forcedPerformanceMode) {
            this.enableParticleOptimization = true;
            this.enableTrailOptimization = true;
            this.reduceParticleCount = true;
            return;
        }

        const avgFps = this.getAverageFps();
        
        // Aggressive optimization for critical performance issues
        if (avgFps < this.criticalFpsThreshold) {
            this.enableParticleOptimization = true;
            this.enableTrailOptimization = true;
            this.reduceParticleCount = true;
        } 
        // Basic optimization for moderate performance issues
        else if (avgFps < this.lowFpsThreshold) {
            this.enableParticleOptimization = true;
            this.enableTrailOptimization = false;
            this.reduceParticleCount = false;
        } 
        // No optimization needed - restore full visual fidelity
        else {
            this.enableParticleOptimization = false;
            this.enableTrailOptimization = false;
            this.reduceParticleCount = false;
        }
    }
    
    /**
     * Calculate average FPS over recent performance history.
     * 
     * Uses the rolling window of FPS samples to determine recent performance trends.
     * This provides more stable optimization decisions than using instantaneous FPS.
     * 
     * @returns {number} Average FPS over recent history, defaults to 60 if no history
     * @example
     * const avgFps = performanceManager.getAverageFps();
     * if (avgFps < 30) {
     *     console.log('Performance is below target');
     * }
     */
    getAverageFps() {
        if (this.fpsHistory.length === 0) return 60;
        return this.fpsHistory.reduce((sum, fps) => sum + fps, 0) / this.fpsHistory.length;
    }
    
    /**
     * Get comprehensive performance statistics and optimization states.
     * 
     * Provides a complete snapshot of current performance metrics and active
     * optimizations. Useful for debugging, UI display, and external systems
     * that need to react to performance changes.
     * 
     * @returns {Object} Complete performance statistics
     * @property {number} returns.currentFps - Most recent FPS measurement
     * @property {number} returns.averageFps - Average FPS over recent history
     * @property {number} returns.frameTime - Current frame delta time in ms
     * @property {Object} returns.optimizations - Current optimization states
     * @property {boolean} returns.optimizations.particles - Particle optimization enabled
     * @property {boolean} returns.optimizations.trails - Trail optimization enabled
     * @property {boolean} returns.optimizations.reducedParticles - Particle count reduction enabled
     * 
     * @example
     * const stats = performanceManager.getStats();
     * console.log(`FPS: ${stats.currentFps} (avg: ${stats.averageFps.toFixed(1)})`);
     * if (stats.optimizations.particles) {
     *     console.log('Particle optimization is active');
     * }
     */
    getStats() {
        return {
            currentFps: this.fps,
            averageFps: this.getAverageFps(),
            frameTime: this.frameTime,
            optimizations: {
                particles: this.enableParticleOptimization,
                trails: this.enableTrailOptimization,
                reducedParticles: this.reduceParticleCount
            }
        };
    }
    
    /**
     * Check if any performance optimizations are currently active.
     * 
     * Convenience method to determine if the system is running in an optimized
     * state. Useful for conditional rendering logic or performance indicators.
     * 
     * @returns {boolean} True if any optimization is currently enabled
     * @example
     * if (performanceManager.needsOptimization()) {
     *     // Show performance warning to user
     *     // Apply reduced visual effects
     * }
     */
    needsOptimization() {
        return this.enableParticleOptimization || this.enableTrailOptimization;
    }
}
