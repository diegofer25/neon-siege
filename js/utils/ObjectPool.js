/**
 * @fileoverview Object pool for performance optimization
 * Manages reusable objects to reduce garbage collection overhead
 * 
 * @example
 * // Create a pool for particle objects
 * const particlePool = new ObjectPool(
 *   () => new Particle(0, 0, 0, 0, 0), // Factory function
 *   (particle, x, y, vx, vy, life) => { // Reset function
 *     particle.x = x;
 *     particle.y = y;
 *     particle.vx = vx;
 *     particle.vy = vy;
 *     particle.life = life;
 *   },
 *   50, // Initial pool size
 *   200 // Maximum pool size
 * );
 * 
 * // Get object from pool
 * const particle = particlePool.get(100, 100, 5, -10, 1000);
 * 
 * // Return object to pool when done
 * particlePool.release(particle);
 */

export class ObjectPool {
    /**
     * Creates a new object pool for managing reusable objects
     * 
     * Object pools are essential for performance in games where many objects
     * are frequently created and destroyed (like particles, projectiles, enemies).
     * They reduce garbage collection pressure by reusing objects instead of
     * constantly allocating new ones.
     * 
     * @param {Function} createFn - Factory function that creates new objects when pool is empty
     * @param {Function} resetFn - Function that resets objects for reuse, receives (object, ...args)
     * @param {number} [initialSize=10] - Number of objects to pre-create in the pool
     * @param {number} [maxSize=100] - Maximum number of objects to keep in the pool
     * @throws {Error} If createFn or resetFn are not functions
     * @throws {Error} If size parameters are invalid (negative or initialSize > maxSize)
     * 
     * @example
     * // Pool for enemy objects
     * const enemyPool = new ObjectPool(
     *   () => new Enemy(0, 0, 50, 100, 10),
     *   (enemy, x, y, speed, health, damage) => {
     *     enemy.x = x;
     *     enemy.y = y;
     *     enemy.speed = speed;
     *     enemy.health = health;
     *     enemy.maxHealth = health;
     *     enemy.damage = damage;
     *     enemy.dying = false;
     *   }
     * );
     */
    constructor(createFn, resetFn, initialSize = 10, maxSize = 100) {
        if (typeof createFn !== 'function') {
            throw new Error('createFn must be a function');
        }
        if (typeof resetFn !== 'function') {
            throw new Error('resetFn must be a function');
        }
        if (initialSize < 0 || maxSize < 0 || initialSize > maxSize) {
            throw new Error('Invalid pool size parameters');
        }

        this.createFn = createFn;
        this.resetFn = resetFn;
        this.maxSize = maxSize;
        /** @type {Array<any>} Available objects in pool */
        this.pool = [];
        /** @type {Array<any>} Currently active objects */
        this.active = [];
        
        // Pre-populate pool with initial objects
        this._populatePool(initialSize);
    }
    
    /**
     * Pre-populates the pool with initial objects to avoid allocation during gameplay
     * 
     * This is called during construction to ensure the pool has objects ready
     * for immediate use, preventing frame drops during initial object requests.
     * 
     * @private
     * @param {number} size - Number of objects to create and add to the pool
     */
    _populatePool(size) {
        for (let i = 0; i < size; i++) {
            try {
                this.pool.push(this.createFn());
            } catch (error) {
                console.error('Failed to create initial pool object:', error);
            }
        }
    }
    
    /**
     * Retrieves an object from the pool, creating one if pool is empty
     * 
     * If the pool has available objects, one is taken and reset with the provided
     * arguments. If the pool is empty, a new object is created using the factory
     * function and then reset. The object is tracked as active until released.
     * 
     * @param {...any} args - Arguments passed to the reset function for object initialization
     * @returns {any} Ready-to-use object configured with the provided arguments
     * 
     * @example
     * // Get a particle with specific properties
     * const particle = particlePool.get(x, y, velocityX, velocityY, lifetime, color);
     * 
     * // Get an enemy at spawn position
     * const enemy = enemyPool.get(spawnX, spawnY, enemySpeed, enemyHealth, enemyDamage);
     */
    get(a, b, c, d, e, f, g, h) {
        let obj;
        
        if (this.pool.length > 0) {
            obj = this.pool.pop();
        } else {
            obj = this.createFn();
        }
        this.resetFn(obj, a, b, c, d, e, f, g, h);

        // Tag with index for O(1) release
        obj._poolIndex = this.active.length;
        this.active.push(obj);
        return obj;
    }
    
    /**
     * Returns an object to the pool for reuse
     * 
     * Objects should be released when they're no longer needed (e.g., when a
     * particle expires, an enemy dies, or a projectile hits something). The
     * object is removed from the active list and added back to the pool if
     * there's space available.
     * 
     * @param {any} obj - Object to return to the pool (must be from this pool's active list)
     * @returns {boolean} True if object was successfully returned to pool, false if:
     *   - Object wasn't found in active list (warning logged)
     *   - Pool is at maximum capacity (object is discarded)
     * 
     * @example
     * // Release a particle when it expires
     * if (particle.isDead()) {
     *   particlePool.release(particle);
     * }
     * 
     * // Release an enemy when it's destroyed
     * if (enemy.health <= 0) {
     *   enemyPool.release(enemy);
     * }
     */
    release(obj) {
        const index = obj._poolIndex;
        if (index == null || index < 0 || index >= this.active.length || this.active[index] !== obj) {
            console.warn('Attempted to release object not in active pool');
            return false;
        }
        
        // Swap-and-pop with index tag: O(1) removal
        const last = this.active.length - 1;
        if (index !== last) {
            const swapped = this.active[last];
            this.active[index] = swapped;
            swapped._poolIndex = index;
        }
        this.active.pop();
        obj._poolIndex = -1;
        
        if (this.pool.length < this.maxSize) {
            this.pool.push(obj);
            return true;
        }
        
        return false; // Pool full, object discarded
    }
    
    /**
     * Returns all active objects to the pool
     * 
     * Useful for cleanup operations like resetting the game state,
     * clearing the screen, or ending a level. Objects are returned
     * to the pool up to the maximum capacity.
     * 
     * @example
     * // Clear all active particles at once
     * particlePool.releaseAll();
     * 
     * // Reset all enemies when starting new wave
     * enemyPool.releaseAll();
     */
    releaseAll() {
        while (this.active.length > 0) {
            const obj = this.active.pop();
            if (this.pool.length < this.maxSize) {
                this.pool.push(obj);
            }
        }
    }
    
    /**
     * Removes all objects from both pool and active list
     * 
     * This completely empties the pool and should be used when the pool
     * is no longer needed or when you want to start fresh. Objects are
     * eligible for garbage collection after this call.
     * 
     * @example
     * // Complete cleanup when changing levels
     * particlePool.clear();
     * enemyPool.clear();
     */
    clear() {
        this.pool.length = 0;
        this.active.length = 0;
    }
    
    /**
     * Provides performance and usage statistics for the pool
     * 
     * Use these metrics to optimize pool sizes and monitor performance.
     * High efficiency (close to 1.0) means most objects are pooled and reused.
     * Low efficiency might indicate the pool is too small or objects aren't
     * being released properly.
     * 
     * @returns {{efficiency: number, pooled: number, active: number, total: number}} Statistics object
     * @property {number} efficiency - Ratio of pooled objects to total (0-1, higher is better)
     * @property {number} pooled - Number of objects available in the pool
     * @property {number} active - Number of objects currently in use
     * @property {number} total - Total number of objects managed by this pool
     * 
     * @example
     * const stats = particlePool.getStats();
     * console.log(`Pool efficiency: ${(stats.efficiency * 100).toFixed(1)}%`);
     * console.log(`${stats.active} active, ${stats.pooled} pooled`);
     * 
     * // Log warning if efficiency is low
     * if (stats.efficiency < 0.5) {
     *   console.warn('Pool efficiency is low, consider increasing pool size');
     * }
     */
    getStats() {
        const total = this.pool.length + this.active.length;
        return {
            pooled: this.pool.length,
            active: this.active.length,
            total,
            efficiency: total > 0 ? (this.pool.length / total) : 0
        };
    }
}
