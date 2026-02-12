import { Particle } from '../Particle.js';
import { MathUtils } from '../utils/MathUtils.js';
import { GameConfig } from '../config/GameConfig.js';

/**
 * Manages all visual effects including particles, screen shake, and special effects.
 */
export class EffectsManager {
    /**
     * Creates a new effects manager instance.
     * @param {import('./../Game.js').Game} game - Reference to the main game instance
     */
    constructor(game) {
        this.game = game;
        this._initializeScreenShake();
    }

    /**
     * Initialize screen shake system.
     * @private
     */
    _initializeScreenShake() {
        this.screenShake = {
            intensity: 0,
            duration: 0,
            offsetX: 0,
            offsetY: 0
        };
    }

    /**
     * Update all effect systems.
     * @param {number} delta - Time elapsed since last frame
     */
    update(delta) {
        // Always update screen shake for visual feedback even when paused
        this.updateScreenShake(delta);
        
        // Only update particles when game is playing
        if (this.game.gameState === 'playing') {
            this.updateParticles(delta);
        }
    }

    /**
     * Add screen shake effect for visual impact feedback.
     * @param {number} intensity - Shake intensity in pixels
     * @param {number} duration - Shake duration in milliseconds
     */
    addScreenShake(intensity, duration) {
        if (this.game?.runtimeSettings?.screenShakeEnabled === false) {
            return;
        }
        this.screenShake.intensity = intensity;
        this.screenShake.duration = duration;
    }

    /**
     * Update screen shake offset values each frame.
     * @param {number} delta - Time elapsed since last frame
     */
    updateScreenShake(delta) {
        if (this.screenShake.duration > 0) {
            this.screenShake.duration -= delta;
            
            const intensity = this.screenShake.intensity * (this.screenShake.duration / 300);
            this.screenShake.offsetX = (Math.random() - 0.5) * intensity;
            this.screenShake.offsetY = (Math.random() - 0.5) * intensity;
        } else {
            this.screenShake.offsetX = 0;
            this.screenShake.offsetY = 0;
        }
    }

    /**
     * Update particle systems with performance optimizations.
     * @param {number} delta - Time elapsed since last frame
     */
    updateParticles(delta) {
        const performanceModeEnabled = this.game?.runtimeSettings?.performanceModeEnabled === true;
        const shouldReduceParticles = this.game.performanceManager.reduceParticleCount || performanceModeEnabled;
        const particleLimit = shouldReduceParticles ? 
            GameConfig.VFX.PARTICLE_LIMITS.MAX_PARTICLES / 2 : 
            GameConfig.VFX.PARTICLE_LIMITS.MAX_PARTICLES;
            
        // Remove excess particles if over limit
        while (this.game.particles.length > particleLimit) {
            const particle = this.game.particles.shift();
            if (particle._fromPool) {
                this.game.particlePool.release(particle);
            }
        }
        
        // Update remaining particles
        this.game.particles.forEach((particle, index) => {
            particle.update(delta);
            
            if (particle.isDead()) {
                this.game.particles.splice(index, 1);
                if (particle._fromPool) {
                    this.game.particlePool.release(particle);
                }
            }
        });
    }

    /**
     * Create explosion particle effect at specified location.
     * @param {number} x - Explosion center X coordinate
     * @param {number} y - Explosion center Y coordinate  
     * @param {number} [particleCount=8] - Number of particles to create
     */
    createExplosion(x, y, particleCount = 8) {
        const performanceModeEnabled = this.game?.runtimeSettings?.performanceModeEnabled === true;
        const shouldReduceParticles = this.game.performanceManager.reduceParticleCount || performanceModeEnabled;
        const actualCount = shouldReduceParticles ? 
            Math.floor(particleCount / 2) : particleCount;
            
        for (let i = 0; i < actualCount; i++) {
            const angle = (Math.PI * 2 / actualCount) * i + Math.random() * 0.5;
            const speed = MathUtils.random(50, 150);
            const life = MathUtils.random(500, 1000);
            
            const particle = this.game.particlePool.get(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                life,
                '#0ff'
            );
            
            this.game.particles.push(particle);
        }
    }

    /**
     * Create visual explosion ring to show blast radius.
     * @param {number} x - Explosion center X coordinate
     * @param {number} y - Explosion center Y coordinate
     * @param {number} radius - Explosion radius in pixels
     */
    createExplosionRing(x, y, radius) {
        // Only create ring if game is actively playing
        if (this.game.gameState !== 'playing') return;
        
        const ringParticle = Particle.createExplosionRing(x, y, radius, '#f80');
        this.game.particles.push(ringParticle);
        this._createDOMExplosionRing(x, y, radius);
    }

    /**
     * Create hit effect when projectiles strike enemies.
     * @param {number} x - Hit location X coordinate
     * @param {number} y - Hit location Y coordinate
     */
    createHitEffect(x, y) {
        const performanceModeEnabled = this.game?.runtimeSettings?.performanceModeEnabled === true;
        const particleCount = (this.game.performanceManager.reduceParticleCount || performanceModeEnabled) ? 2 : 4;
        
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = MathUtils.random(20, 60);
            const life = MathUtils.random(200, 400);
            
            const particle = this.game.particlePool.get(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                life,
                '#fff'
            );
            
            this.game.particles.push(particle);
        }
    }

    /**
     * Create DOM-based explosion ring overlay for maximum visibility.
     * @private
     * @param {number} x - Explosion center X coordinate
     * @param {number} y - Explosion center Y coordinate
     * @param {number} radius - Explosion radius in canvas pixels
     */
    _createDOMExplosionRing(x, y, radius) {
        const ring = document.createElement('div');
        ring.className = 'explosion-ring';
        
        // Convert canvas coordinates to screen coordinates
        const rect = this.game.canvas.getBoundingClientRect();
        const canvasWidth = this.game.canvas.logicalWidth || this.game.canvas.width;
        const canvasHeight = this.game.canvas.logicalHeight || this.game.canvas.height;
        const screenX = (x / canvasWidth) * rect.width + rect.left;
        const screenY = (y / canvasHeight) * rect.height + rect.top;
        const screenRadius = (radius / canvasWidth) * rect.width;
        
        // Position and size the ring
        const ringSize = screenRadius * 2;
        ring.style.left = (screenX - screenRadius) + 'px';
        ring.style.top = (screenY - screenRadius) + 'px';
        ring.style.width = ringSize + 'px';
        ring.style.height = ringSize + 'px';
        
        document.getElementById('gameContainer').appendChild(ring);
        
        setTimeout(() => {
            if (ring.parentNode) {
                ring.parentNode.removeChild(ring);
            }
        }, 600);
    }
}
