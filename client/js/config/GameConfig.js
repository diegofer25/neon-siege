/**
 * @fileoverview Centralized game configuration and balance settings
 * 
 * This module contains all game constants, balance parameters, and configuration
 * settings. Centralizing these values makes it easy to tune gameplay, maintain
 * balance, and ensure consistency across the entire game.
 * 
 * Configuration is organized into logical groups:
 * - CANVAS: Display and rendering settings
 * - PLAYER: Player character stats and abilities
 * - ENEMY: Enemy behavior and scaling
 * - WAVE: Wave progression and difficulty
 * - POWERUP_PRICES: Shop pricing for all power-ups
 * - STACK_LIMITS: Maximum stacks for upgradeable power-ups
 * - VFX: Visual effects and performance settings
 * - ECONOMY: Coin rewards and economic balance
 * - BALANCE: High-level balance constraints
 * - PERFORMANCE_PROFILES: Tunable presets for different device capabilities
 * - META: Persistent progression and unlock configuration
 * - WAVE_MODIFIERS: Special scenario definitions applied to specific waves
 * 
 * @example
 * // Using configuration values
 * const playerHealth = GameConfig.PLAYER.BASE_HP;
 * const enemyCount = GameConfig.DERIVED.getEnemyCountForWave(5);
 * const powerUpPrice = GameConfig.POWERUP_PRICES["Damage Boost"];
 * 
 * // Validating dimensions
 * GameConfig.CANVAS.validateDimensions(800, 600);
 */

/**
 * Validates that a numeric value is within specified bounds
 * 
 * @param {number} value - Value to validate
 * @param {number} min - Minimum allowed value (inclusive)
 * @param {number} max - Maximum allowed value (inclusive)
 * @param {string} name - Descriptive name for error messages
 * @throws {Error} If value is outside the valid range
 */
function validateRange(value, min, max, name) {
    if (value < min || value > max) {
        throw new Error(`${name} must be between ${min} and ${max}, got ${value}`);
    }
}

/**
 * Main game configuration object containing all game constants and settings
 * 
 * This object is frozen to prevent accidental modification during runtime.
 * All values should be carefully considered as they affect game balance.
 */
export const GameConfig = {
    /**
     * Canvas and display configuration
     * 
     * Controls the game's visual presentation and responsive behavior.
     * The game maintains a 4:3 aspect ratio for consistent gameplay
     * across different screen sizes.
     */
    CANVAS: {
        /** @type {number} Target aspect ratio (width/height) for consistent gameplay */
        TARGET_ASPECT_RATIO: 4/3,
        
        /** @type {number} Minimum canvas width in pixels for playability */
        MIN_WIDTH: 320,
        
        /** @type {number} Reference width used as scale baseline (scale = 1.0 at this width) */
        MAX_WIDTH: 800,
        
        /** @type {number} Reference height used as scale baseline (scale = 1.0 at this height) */
        MAX_HEIGHT: 600,

        /** @type {number} Minimum spawn-pressure scaling multiplier */
        PRESSURE_SCALE_MIN: 0.75,

        /** @type {number} Maximum spawn-pressure scaling multiplier */
        PRESSURE_SCALE_MAX: 2.25,

        /** @type {number} Maximum device pixel ratio used for canvas backing store */
        MAX_DEVICE_PIXEL_RATIO: 2,

        /** @type {number} Hard upper limit on canvas width (supports up to 8K) */
        HARD_MAX_WIDTH: 7680,

        /** @type {number} Hard upper limit on canvas height (supports up to 8K) */
        HARD_MAX_HEIGHT: 4320,
        
        /**
         * Validates canvas dimensions against game requirements
         * 
         * @param {number} width - Proposed canvas width
         * @param {number} height - Proposed canvas height
         * @throws {Error} If dimensions are outside valid ranges
         */
        validateDimensions(width, height) {
            validateRange(width, this.MIN_WIDTH, this.HARD_MAX_WIDTH, 'Canvas width');
            validateRange(height, this.MIN_WIDTH * 0.75, this.HARD_MAX_HEIGHT, 'Canvas height');
        }
    },

    /**
     * Player character configuration
     * 
     * Base stats for the player character. These values are modified
     * by power-ups during gameplay but serve as the starting point
     * and reference for balance calculations.
     */
    PLAYER: {
        /** @type {number} Starting and base health points */
        BASE_HP: 100,
        /** @type {number} Base damage per projectile before modifiers */
        BASE_DAMAGE: 10,
        /** @type {number} Base fire rate in milliseconds between shots */
        BASE_FIRE_RATE: 1000,
        /** @type {number} Player collision radius in pixels */
        RADIUS: 20,
        /** @type {number} Player movement speed in pixels per second */
        MOVE_SPEED: 75,
        /** @type {number} Base projectile speed in pixels per second */
        BASE_PROJECTILE_SPEED: 200,
        // Player-specific ability constants
        /** @type {number} Number of enemies piercing shots can hit */
        PIERCING_COUNT: 3,
        /** @type {number} Damage reduction per enemy pierced (0.25 = 25% reduction) */
        PIERCING_DAMAGE_REDUCTION: 0.25,
        /** @type {number} Angle spread for triple shot in radians */
        TRIPLE_SHOT_SPREAD: 0.3,
        /** @type {number} Percentage of enemy max health restored on kill with life steal */
        LIFE_STEAL_PERCENTAGE: 0.1,
        // Player rotation and aiming system
        /** @type {number} Player rotation speed in radians per second */
        ROTATION_SPEED: (Math.PI * 2) / 2, // 2 seconds for a full rotation
        /** @type {number} Angular tolerance for firing in radians (approximately 5 degrees) */
        FIRING_TOLERANCE: Math.PI / 36,
        /** @type {number} Maximum time to spend rotating before giving up on target in milliseconds */
        MAX_ROTATION_TIME: 1500,
        /** @type {number} Maximum health points */
        MAX_HP: 100,
        /** @type {number} Base radius for slow field effect */
        SLOW_FIELD_BASE_RADIUS: 80,
        /** @type {number} Maximum slow field stack count */
        MAX_SLOW_FIELD_STACKS: 6,
        /** @type {number} Number of particles in muzzle flash effect */
        MUZZLE_FLASH_PARTICLES: 3,
        /** @type {number} Distance from player center to muzzle flash */
        MUZZLE_FLASH_DISTANCE: 10,

        /** @type {number} Brief invulnerability window after taking enemy projectile damage (ms) */
        ENEMY_PROJECTILE_IFRAMES_MS: 120
    },

    /**
     * Enemy configuration and behavior
     * 
     * Base stats for enemy units. Different enemy types use multipliers
     * on these base values, and wave scaling further modifies them.
     */
    ENEMY: {
        /** @type {number} Base health points for standard enemies */
        BASE_HEALTH: 11,
        
        /** @type {number} Base movement speed in pixels per second */
        BASE_SPEED: 35,
        
        /** @type {number} Base damage dealt to player on contact */
        BASE_DAMAGE: 10,
        
        /** @type {number} Enemy collision radius in pixels */
        RADIUS: 15,
        
        /** @type {number} Distance outside screen bounds where enemies spawn */
        SPAWN_MARGIN: 50,

        /**
         * Healer enemy behavior tuning
         */
        HEALER: {
            HEAL_RADIUS: 120,
            HEAL_AMOUNT: 0.05,
            HEAL_INTERVAL: 2000,
            HEAL_COLOR: '#00ff88'
        },
        
        /**
         * Enemy variant multipliers for creating different enemy types
         * 
         * Each variant applies these multipliers to base stats:
         * - FAST: Low health, high speed glass cannons
         * - TANK: High health, low speed bullet sponges
         * - SPLITTER: Medium stats, splits into smaller enemies on death
         */
        VARIANTS: {
            FAST: { health: 0.5, speed: 2.0, damage: 1.5 },
            TANK: { health: 3.0, speed: 0.5, damage: 2.5 },
            SPLITTER: { health: 2.0, speed: 0.8, damage: 1.8 },
            HEALER: { health: 1.5, speed: 0.7, damage: 1.2 }
        }
    },

    /**
     * Boss configuration and behavior
     * 
     * Base stats and attack parameters for the boss enemy.
     * The boss has significantly higher stats and unique attack patterns
     * compared to regular enemies, and appears at the end of certain waves.
     */
    BOSS: {
        /** @type {number} Base health points for the boss */
        BASE_HEALTH: 500,
        
        /** @type {number} Base damage dealt by the boss */
        BASE_DAMAGE: 25,
        
        /** @type {number} Boss movement speed in pixels per second */
        SPEED: 35,
        
        /** @type {number} Boss collision radius in pixels */
        RADIUS: 50,
        
        /** @type {number} Attack cooldown in milliseconds */
        ATTACK_COOLDOWN: 2000,
        
        /** @type {number} Minion spawn cooldown in milliseconds */
        MINION_SPAWN_COOLDOWN: 5000,
        
        /** @type {number} Base projectile speed for boss attacks */
        PROJECTILE_SPEED: 200,

        /** @type {number} How often boss waves appear (every N waves) */
        WAVE_INTERVAL: 5,

        /** @type {number} Final wave of the main campaign (victory condition) */
        MAX_WAVE: 30,

        /**
         * Shield Boss tuning values
         */
        SHIELD_BOSS: {
            /** @type {number} Shield health as a ratio of boss max health */
            SHIELD_HEALTH_RATIO: 0.35,
            /** @type {number} Shield regeneration per second as a ratio of max shield */
            SHIELD_REGEN_RATE: 0.01,
            /** @type {number} Delay before shield regeneration starts after taking damage */
            SHIELD_REGEN_COOLDOWN: 4500,
            /** @type {number} Duration of vulnerable phase after shield breaks */
            VULNERABILITY_DURATION: 6000,
            /** @type {number} Number of times shield can reactivate after being broken */
            MAX_SHIELD_REACTIVATIONS: 0,
            /** @type {number} Cooldown between shield burst attacks */
            SHIELD_BURST_COOLDOWN: 9500
        },

        /**
         * Teleporter Boss tuning values
         */
        TELEPORTER_BOSS: {
            /** @type {number} Time between teleports in ms */
            TELEPORT_COOLDOWN: 3000,
            /** @type {number} Number of aimed projectiles fired after teleport */
            SALVO_COUNT: 5,
            /** @type {number} Duration a toxic pool persists in ms */
            POOL_DURATION: 4000,
            /** @type {number} Damage per second from toxic pool */
            POOL_DPS: 8,
            /** @type {number} Radius of toxic pools */
            POOL_RADIUS: 60
        },

        /**
         * Splitter Boss tuning values
         */
        SPLITTER_BOSS: {
            /** @type {number} HP fraction that triggers a split */
            SPLIT_THRESHOLD: 0.5,
            /** @type {number} Number of copies produced per split */
            SPLIT_COUNT: 3,
            /** @type {number} Scale factor applied to radius on each split */
            SPLIT_SCALE: 0.65,
            /** @type {number} Max number of active split copies to prevent runaway */
            MAX_COPIES: 9,
            /** @type {number} Speed multiplier applied to split children */
            CHILD_SPEED_MULTIPLIER: 1.6
        },

        /**
         * Vortex Boss tuning values
         */
        VORTEX_BOSS: {
            /** @type {number} Gravity pull strength (px/s²) applied to the player */
            PULL_STRENGTH: 90,
            /** @type {number} Max range for gravity pull */
            PULL_RANGE: 500,
            /** @type {number} Cooldown between mine spawns in ms */
            MINE_COOLDOWN: 2200,
            /** @type {number} Number of orbiting mines */
            MINE_COUNT: 5,
            /** @type {number} Shockwave expansion speed (px/s) */
            SHOCKWAVE_SPEED: 400,
            /** @type {number} Cooldown between shockwave attacks in ms */
            SHOCKWAVE_COOLDOWN: 3500
        },

        /**
         * Chrono Boss tuning values (final boss)
         */
        CHRONO_BOSS: {
            /** @type {number} Duration of the speed-burst phase in ms */
            SPEED_PHASE_DURATION: 3000,
            /** @type {number} Duration of the slow-field phase in ms */
            SLOW_PHASE_DURATION: 3500,
            /** @type {number} Player speed multiplier during slow phase */
            SLOW_FIELD_FACTOR: 0.35,
            /** @type {number} Boss speed multiplier during speed phase */
            SPEED_BURST_FACTOR: 3.5,
            /** @type {number} Projectile count in combined burst pattern */
            COMBO_BURST_COUNT: 32,
            /** @type {number} Radius of the slow field */
            SLOW_FIELD_RADIUS: 450
        }
    },

    /**
     * Wave progression and difficulty scaling
     * 
     * Controls how the game becomes more challenging over time.
     * Linear enemy count growth combined with exponential stat scaling
     * creates a smooth but accelerating difficulty curve.
     */
    WAVE: {
        /** @type {number} Number of enemies in wave 1 */
        BASE_ENEMY_COUNT: 4,
        
        /** @type {number} Additional enemies per wave (linear growth) */
        ENEMY_COUNT_SCALING: 2,
        
        /**
         * Exponential scaling factors applied each wave
         * 
         * Each wave multiplies enemy stats by these factors.
         * Values > 1.0 increase difficulty, < 1.0 would decrease it.
         */
        SCALING_FACTORS: {
            /** @type {number} Health multiplier per wave (12% increase — compressed 30-wave curve) */
            HEALTH: 1.12,
            
            /** @type {number} Speed multiplier per wave (4% increase) */
            SPEED: 1.04,
            
            /** @type {number} Damage multiplier per wave (8% increase) */
            DAMAGE: 1.08
        },
        
        // Enemy spawn timing controls
        
        /** @type {number} Initial time between enemy spawns in milliseconds */
        BASE_SPAWN_INTERVAL: 800,
        
        /** @type {number} Minimum spawn interval to prevent overwhelming spam */
        MIN_SPAWN_INTERVAL: 300,
        
        /** @type {number} Reduction in spawn interval per wave in milliseconds */
        SPAWN_INTERVAL_REDUCTION: 20
    },

    /**
     * Difficulty presets applied at run level
     */
    DIFFICULTY_PRESETS: {
        easy: {
            label: 'Easy',
            enemyCountMultiplier: 0.85,
            enemyHealthMultiplier: 0.85,
            enemySpeedMultiplier: 0.9,
            enemyDamageMultiplier: 0.85,
            spawnIntervalMultiplier: 1.1
        },
        normal: {
            label: 'Normal',
            enemyCountMultiplier: 1,
            enemyHealthMultiplier: 1,
            enemySpeedMultiplier: 1,
            enemyDamageMultiplier: 1,
            spawnIntervalMultiplier: 1
        },
        hard: {
            label: 'Hard',
            enemyCountMultiplier: 1.2,
            enemyHealthMultiplier: 1.15,
            enemySpeedMultiplier: 1.12,
            enemyDamageMultiplier: 1.2,
            spawnIntervalMultiplier: 0.9
        }
    },

    /**
     * Power-up shop pricing
     * 
     * Base prices in coins for each power-up. Actual prices may be modified
     * by stacking multipliers and wave-based inflation. Prices are balanced
     * around the expected coin income per wave.
     */
    POWERUP_PRICES: {
        // Common offensive upgrades (affordable early game)
        "Damage Boost": 15,
        "Fire Rate": 12,
        "Speed Boost": 10,
        "Turn Speed": 18,
        
        // Defensive options (moderate cost)
        "Max Health": 20,
        "Shield": 30,
        "Full Heal": 25,
        
        // Advanced abilities (higher cost, more impactful)
        "Piercing Shots": 35,
        "Triple Shot": 40,
        "Explosive Shots": 60,
        
        // Rare and powerful upgrades (premium pricing)
        "Life Steal": 50,
        "Double Damage": 80,
        "Rapid Fire": 55,
        
        // Utility and support abilities
        "Slow Field": 25,
        "Regeneration": 45,
        "Shield Regen": 40,
        "Bigger Explosions": 35,
        "Coin Magnet": 20,
        "Lucky Shots": 30,
        "Immolation Aura": 55,
        
        // Shield Boss Counter abilities (premium pricing for specialized use)
        "Shield Breaker": 70,
        "Adaptive Targeting": 65,
        "Barrier Phase": 80,
        "Overcharge Burst": 75,
        "Emergency Heal": 60
    },

    /**
     * Maximum stack limits for upgradeable power-ups
     * 
     * Prevents infinite scaling while allowing meaningful progression.
     * Limits are set to provide significant power increases without
     * breaking game balance in later waves.
     */
    STACK_LIMITS: {
        // Damage scaling (multiplicative effects)
        "Damage Boost": 10,    // Up to 15x damage (1.5^10)
        "Double Damage": 5,    // Up to 32x damage (2^5)
        
        // Attack speed (multiplicative effects)
        "Fire Rate": 8,        // Up to 6.3x attack speed (1.25^8)
        "Rapid Fire": 5,       // Up to 7.6x attack speed (1.5^5)
        
        // Movement and aiming (multiplicative effects)
        "Turn Speed": 8,       // Up to 4.3x rotation speed (1.2^8)
        
        // Projectile abilities
        "Piercing Shots": 6,   // Up to 6 additional pierces per projectile
        
        // Health and defense (additive effects)
        "Max Health": 10,      // Up to 300% base health
        "Shield": 8,           // Up to 250 shield points
        
        // Regeneration (additive effects)
        "Regeneration": 10,    // Up to 50 HP/second
        "Shield Regen": 8,     // Up to 80 shield/second
        
        // Utility abilities
        "Speed Boost": 6,      // Up to 4.7x projectile speed
        "Bigger Explosions": 6, // Up to 11.4x explosion size
        "Slow Field": 6,       // Up to 90% enemy slow
        "Coin Magnet": 8,      // Up to 5x coin rewards (1 + 8*0.5)
        "Lucky Shots": 5,      // Up to 50% crit chance
        "Immolation Aura": 10,   // Up to 10% max health burn damage
        
        // Shield Boss Counter abilities
        "Shield Breaker": 5,   // Up to 4.5x shield damage, 7s regen delay
        "Overcharge Burst": 3, // Down to every 5th shot, 11x damage
        "Emergency Heal": 3,   // Down to 20s cooldown, heal to 80%
    },

    // Audio configuration
    AUDIO: {
        /** @type {number} Background music volume (0.0 to 1.0) */
        BGM_VOLUME: 0.3,
        
        /** @type {number} Sound effects volume (0.0 to 1.0) */
        SFX_VOLUME: 0.5
    },

    /**
     * Visual effects and performance settings
     * 
     * Controls the intensity and limits of visual effects to maintain
     * performance across different devices.
     */
    VFX: {
        /**
         * Particle system limits to prevent performance issues
         */
        PARTICLE_LIMITS: {
            /** @type {number} Maximum particles active at once */
            MAX_PARTICLES: 150,
            
            /** @type {number} Maximum projectiles active at once */
            MAX_PROJECTILES: 100
        },
        
        /**
         * Screen shake configuration for different events
         */
        SCREEN_SHAKE: {
            /** @type {number} Screen shake intensity when player is hit */
            PLAYER_HIT_INTENSITY: 10,
            
            /** @type {number} Duration of player hit screen shake in milliseconds */
            PLAYER_HIT_DURATION: 300,
            
            /** @type {number} Screen shake intensity for explosions */
            EXPLOSION_INTENSITY: 5,
            
            /** @type {number} Duration of explosion screen shake in milliseconds */
            EXPLOSION_DURATION: 200
        },
        
        /** @type {number} Background grid line spacing in pixels */
        GRID_SIZE: 50,
        
        /** @type {number} Background grid opacity (0.0 to 1.0) */
        GRID_ALPHA: 0.1,

        /**
         * Player aura visual effects driven by attribute & skill investment.
         * Tunable thresholds, colors, particle counts, and timing.
         */
        PLAYER_AURAS: {
            /** Maximum dedicated aura particles (separate budget from combat particles) */
            MAX_AURA_PARTICLES: 30,

            /** STR — fire glow & wisps */
            STR: {
                color: '#ff4500',
                colorAlt: '#ff8c00',
                /** shadowBlur range: base 15 → 15 + level * GLOW_PER_POINT */
                GLOW_PER_POINT: 0.4,
                /** Fire-wisp orbit starts at this attribute level */
                WISP_THRESHOLD: 15,
                /** Max orbiting wisps */
                MAX_WISPS: 4,
                /** Orbit radius (px from player centre) */
                ORBIT_RADIUS: 22,
                /** Orbit angular speed (rad/s) */
                ORBIT_SPEED: 1.8,
                /** Radial gradient starts at this attribute level */
                GRADIENT_THRESHOLD: 8,
            },

            /** DEX — speed lines, tracers, target-sweep arc */
            DEX: {
                color: '#00e5ff',
                /** Number of arc streaks when rotating */
                SPEED_LINES: 5,
                /** Streak length multiplied by dexLevel (px) */
                STREAK_LEN_PER_POINT: 0.6,
                /** Target-sweep arc decay time (ms) */
                SWEEP_DURATION: 220,
                /** Tracer trail extra length per DEX point (px) */
                TRACER_LEN_PER_POINT: 0.4,
            },

            /** VIT — heartbeat pulse ring */
            VIT: {
                color: '#00ff88',
                /** Base pulse speed (multiplier on sin frequency) */
                BASE_PULSE_SPEED: 0.003,
                /** Additional pulse speed per VIT point */
                PULSE_SPEED_PER_POINT: 0.00006,
                /** Ring thickness range 1→4 */
                MIN_THICKNESS: 1,
                MAX_THICKNESS: 4,
                /** Ring alpha range 0.1→0.5 */
                MIN_ALPHA: 0.1,
                MAX_ALPHA: 0.5,
                /** Orbit offset from player radius */
                RING_OFFSET: 12,
            },

            /** INT — orbiting arcane sparks */
            INT: {
                colors: ['#00ffff', '#aa44ff'],
                /** One spark per this many INT points */
                POINTS_PER_SPARK: 8,
                /** Maximum orbiting sparks */
                MAX_SPARKS: 6,
                /** Orbit radius */
                ORBIT_RADIUS: 20,
                /** Orbit angular speed (rad/s) */
                ORBIT_SPEED: 2.2,
                /** Trail afterglow starts at this INT level */
                TRAIL_THRESHOLD: 30,
            },

            /** LUCK — golden sparkle glitter */
            LUCK: {
                color: '#ffd700',
                /** Spawn probability per frame = luckLevel * CHANCE_PER_POINT */
                CHANCE_PER_POINT: 0.003,
                /** Max concurrent sparkles */
                MAX_SPARKLES: 8,
                /** Sparkle radius (px) */
                SPARKLE_RADIUS: 2.5,
                /** Sparkle life range (ms) */
                MIN_LIFE: 200,
                MAX_LIFE: 400,
                /** Spawn radius from player centre */
                SPAWN_RADIUS: 22,
            },

            /** Purchase moment juice */
            PURCHASE: {
                /** Screen shake on skill learn */
                SKILL_SHAKE_INTENSITY: 3,
                SKILL_SHAKE_DURATION: 150,
                /** Particle burst count on skill learn */
                SKILL_BURST_COUNT: 12,
                /** Particle burst count on attribute allocate */
                ATTR_BURST_COUNT: 6,
                /** Flash pulse duration (ms) */
                FLASH_DURATION: 300,
            },

            /** Movement thruster visual (hover effect replaces legs) */
            THRUSTER: {
                /** Thruster glow color (overridden by archetype theme) */
                COLOR: '#00e5ff',
                /** Secondary thruster color (overridden by archetype theme) */
                COLOR_ALT: '#ff2dec',
                /** Number of thruster dots */
                PARTICLES: 3,
                /** Maximum alpha */
                MAX_ALPHA: 0.6,
                /** Idle maximum alpha (dimmer when not moving) */
                IDLE_MAX_ALPHA: 0.3,
                /** Dot radius (px) */
                SIZE: 3.5,
                /** Large inner core radius (px) */
                CORE_SIZE: 2,
                /** Thruster offset from body rear (px) */
                OFFSET: 8,
                /** Spread angle of thruster dots (rad) */
                SPREAD: 0.5,
                /** Exhaust trail length when moving (px) */
                TRAIL_LENGTH: 12,
                /** Exhaust flicker speed */
                FLICKER_SPEED: 0.008,
            },

            /** Idle breathing and movement body modifiers */
            BODY: {
                /** Idle breathing oscillation speed (for sin) */
                IDLE_BREATHE_SPEED: 0.00125,
                /** Idle breathing scale amplitude (±) */
                IDLE_BREATHE_SCALE: 0.02,
                /** Squish factor when moving (1 = none, 0.92 = 8% squish) */
                MOVE_TILT_SQUISH: 0.92,
                /** Visor arc glow color */
                VISOR_COLOR: '#00ffff',
                /** Hover bob amplitude (px) when idle */
                HOVER_BOB_AMPLITUDE: 1.2,
                /** Hover bob speed (for sin frequency) */
                HOVER_BOB_SPEED: 0.002,
            },

            /**
             * Archetype-based color themes for the player body.
             * Each theme defines the full color palette used by the renderer.
             */
            ARCHETYPE_THEMES: {
                /** Default theme before any archetype is chosen */
                DEFAULT: {
                    bodyColor: '#ff2dec',
                    bodyColorActive: '#ff6d00',
                    glowColor: '#ff2dec',
                    visorColor: '#00ffff',
                    gunAccentColor: '#aaaaaa',
                    thrusterColor: '#00e5ff',
                    thrusterColorAlt: '#ff2dec',
                },
                /** Gunner — aggressive reds & oranges */
                GUNNER: {
                    bodyColor: '#ff6d00',
                    bodyColorActive: '#ff4500',
                    glowColor: '#ff4500',
                    visorColor: '#ff2dec',
                    gunAccentColor: '#ff4444',
                    thrusterColor: '#ff6d00',
                    thrusterColorAlt: '#ff4500',
                },
                /** Technomancer — arcane cyans & purples */
                TECHNOMANCER: {
                    bodyColor: '#aa44ff',
                    bodyColorActive: '#00e5ff',
                    glowColor: '#00e5ff',
                    visorColor: '#00ffff',
                    gunAccentColor: '#6666ff',
                    thrusterColor: '#00e5ff',
                    thrusterColorAlt: '#aa44ff',
                },
            },

            /** Skill-specific VFX timing */
            SKILL_VFX: {
                /** Critical Mastery spark interval (ms) */
                CRIT_SPARK_INTERVAL: 2000,
                CRIT_SPARK_DURATION: 100,
                /** Elemental Synergy color swap interval (ms) */
                SYNERGY_SWAP_INTERVAL: 500,
                /** Volatile Kills shimmer frequency (Hz) */
                VOLATILE_SHIMMER_HZ: 4,
                /** Chain Hit lightning flicker interval range (ms) */
                CHAIN_FLICKER_MIN: 400,
                CHAIN_FLICKER_MAX: 1200,
            },
        },
    },

    /**
     * Performance presets that tune pooling and particle limits for different devices
     * These presets are used by the performance manager to quickly scale effects.
     */
    PERFORMANCE_PROFILES: {
        HIGH: {
            particlePoolSize: { initial: 80, max: 240 },
            projectilePoolSize: { initial: 60, max: 160 },
            particleLimit: 150
        },
        MEDIUM: {
            particlePoolSize: { initial: 60, max: 180 },
            projectilePoolSize: { initial: 45, max: 120 },
            particleLimit: 80
        },
        LOW: {
            particlePoolSize: { initial: 40, max: 120 },
            projectilePoolSize: { initial: 30, max: 90 },
            particleLimit: 50
        }
    },

    /**
     * Economic system configuration
     * 
     * Controls coin rewards, pricing inflation, and economic balance.
     * Designed to provide steady progression while maintaining challenge.
     */
    ECONOMY: {
        /** @type {number} Base coins awarded per enemy kill (reduced for better balance) */
        BASE_COIN_REWARD: 0.5,
        
        /** @type {number} Additional coins per wave level (multiplier, reduced by half) */
        WAVE_COIN_MULTIPLIER: 0.1,
        
        /** @type {number} Base coins for completing a wave */
        WAVE_COMPLETION_BASE_COINS: 10,
        
        /** @type {number} Additional coins per wave completed */
        WAVE_COMPLETION_WAVE_BONUS: 2,
        
        /** @type {number} Divisor for performance bonus calculation */
        PERFORMANCE_BONUS_DIVISOR: 5,
        
        /** @type {number} Linear price increase multiplier per stack of power-ups (deprecated) */
        SHOP_STACK_PRICE_MULTIPLIER: 0.5,
        
        /** @type {number} Exponential price scaling base multiplier for stackable power-ups */
        EXPONENTIAL_PRICE_BASE: 1.5,
        
        /** @type {number} Price scaling factor based on initial price (higher base price = higher scaling) */
        PRICE_BASED_SCALING_FACTOR: 0.02
    },

    /**
     * High-level balance constraints
     * 
     * These limits prevent runaway scaling and maintain game balance
     * even in very long play sessions.
     */
    BALANCE: {
        /** @type {number} Maximum multiplier for wave scaling to prevent infinite growth */
        MAX_WAVE_SCALING: 5.0,
        
        /** @type {number} Price inflation factor per wave (compound growth) */
        COIN_INFLATION_FACTOR: 1.05,
        
        /** @type {number} Minimum kill ratio for performance bonus (0.0 to 1.0) */
        PERFORMANCE_BONUS_THRESHOLD: 0.8,

        /** @type {number} Base multiplier for diminishing returns on stacking multipliers */
        DIMINISHING_RETURN_BASE: 0.85,

        /** @type {number} Minimum interval for basic attack cadence (ms) */
        MIN_BASIC_FIRE_INTERVAL_MS: 110,

        /** @type {number} Temporary loot buff fire rate multiplier */
        LOOT_FIRE_RATE_MULTIPLIER: 1.4,

        /** @type {number} Temporary loot buff damage multiplier */
        LOOT_DAMAGE_MULTIPLIER: 1.6,

        /** @type {number} Maximum allowed total damage multiplier from loot damage buffs */
        MAX_LOOT_DAMAGE_MULTIPLIER: 1.8
    },

    /**
     * Persistent meta progression configuration
     */
    META: {
        STORAGE_KEY: 'neon_td_meta',
        CURRENCIES: {
            LEGACY_TOKENS: {
                label: 'Legacy Tokens',
                description: 'Earned from each completed wave and used for permanent upgrades.',
                perWaveReward: 1,
                bossBonus: 5
            }
        },
        UNLOCKS: {
            SHIELD_BREAKER: {
                cost: 25,
                description: 'Start runs with Shield Breaker unlocked.'
            },
            LUCKY_START: {
                cost: 30,
                description: 'Begin each run with +10% critical chance.'
            },
            SKILL_TIER_3: {
                cost: 15,
                description: 'Unlock tier-3 skills in any archetype.'
            },
            SKILL_TIER_4: {
                cost: 30,
                description: 'Unlock tier-4 (ultimate) skills in any archetype.'
            }
        }
    },

    /**
     * Arcade continue / credits system
     *
     * Players get a fixed number of free lifetime continues.
     * After that they purchase credits via Stripe ($1 = 10 credits).
     * Each continue costs 1 credit and loads the last wave checkpoint.
     */
    CONTINUE: {
        /** One-time free credits granted to every new account */
        FREE_CREDITS: 3,
        /** How many credits a single purchase grants */
        CREDITS_PER_PURCHASE: 10,
        /** Display price (cosmetic — actual price comes from Stripe) */
        PRICE_DISPLAY: '$1.00',
    },

    /**
     * Special wave modifiers controlling global conditions per wave
     */
    WAVE_MODIFIERS: {
        STORM: {
            name: 'Ion Storm',
            description: 'Enemy projectiles move 20% faster, player regen halved.',
            effect: {
                enemySpeedMultiplier: 1.2,
                playerRegenMultiplier: 0.5
            }
        },
        OVERCLOCK: {
            name: 'Overclock',
            description: 'Enemies move 30% faster but take 10% more damage.',
            effect: {
                enemySpeedMultiplier: 1.3,
                enemyDamageTakenMultiplier: 1.1
            }
        },
        FOG: {
            name: 'Neon Fog',
            description: 'Visibility reduced. Player turn speed reduced by 15%.',
            effect: {
                visibilityReduction: true,
                playerTurnSpeedMultiplier: 0.85
            }
        }
    }
};

/**
 * Derived calculations and complex configuration functions
 * 
 * These functions compute values based on the base configuration,
 * providing a clean interface for wave-based scaling and dynamic
 * value calculation.
 */
GameConfig.DERIVED = {
    /**
     * Calculates the number of enemies to spawn for a given wave
     * 
     * Uses linear scaling to provide steady increase in enemy count.
     * Formula: BASE_ENEMY_COUNT + (wave * ENEMY_COUNT_SCALING)
     * 
     * @param {number} wave - Wave number (1-based indexing)
     * @returns {number} Number of enemies to spawn this wave
     * @throws {Error} If wave number is less than 1
     * 
     * @example
     * const wave5Enemies = GameConfig.DERIVED.getEnemyCountForWave(5);
     * // Returns: 4 + (5 * 2) = 14 enemies
     */
    getEnemyCountForWave(wave) {
        if (wave < 1) throw new Error('Wave number must be >= 1');
        
        return Math.floor(
            GameConfig.WAVE.BASE_ENEMY_COUNT + 
            wave * GameConfig.WAVE.ENEMY_COUNT_SCALING
        );
    },
    
    /**
     * Calculates spawn interval between enemies for a given wave
     * 
     * Enemies spawn faster in later waves to maintain pressure.
     * Interval decreases linearly but has a minimum threshold.
     * 
     * @param {number} wave - Wave number (1-based indexing)
     * @returns {number} Spawn interval in milliseconds
     * @throws {Error} If wave number is less than 1
     * 
     * @example
     * const wave10Interval = GameConfig.DERIVED.getSpawnIntervalForWave(10);
     * // Returns: max(300, 800 - (10 * 20)) = 600ms
     */
    getSpawnIntervalForWave(wave) {
        if (wave < 1) throw new Error('Wave number must be >= 1');
        
        const reduction = wave * GameConfig.WAVE.SPAWN_INTERVAL_REDUCTION;
        return Math.max(
            GameConfig.WAVE.MIN_SPAWN_INTERVAL,
            GameConfig.WAVE.BASE_SPAWN_INTERVAL - reduction
        );
    },
    
    /**
     * Calculates enemy stat scaling multipliers for a given wave
     * 
     * Uses exponential scaling to create increasing difficulty.
     * Each stat scales independently based on its factor.
     * Scaling is capped to prevent infinite growth.
     * 
     * @param {number} wave - Wave number (1-based indexing)
     * @returns {{health: number, speed: number, damage: number}} Scaling multipliers
     * @throws {Error} If wave number is less than 1
     * 
     * @example
     * const wave5Scaling = GameConfig.DERIVED.getScalingForWave(5);
     * // Returns: { health: 1.75, speed: 1.46, damage: 1.75 }
     * // (approximately, using 1.15^4 for health/damage, 1.1^4 for speed)
     */
    getScalingForWave(wave) {
        if (wave < 1) throw new Error('Wave number must be >= 1');
        
        const { SCALING_FACTORS } = GameConfig.WAVE;
        const waveIndex = wave - 1; // Convert to 0-based for calculations
        
        return {
            health: Math.min(
                Math.pow(SCALING_FACTORS.HEALTH, waveIndex),
                GameConfig.BALANCE.MAX_WAVE_SCALING
            ),
            speed: Math.min(
                Math.pow(SCALING_FACTORS.SPEED, waveIndex),
                GameConfig.BALANCE.MAX_WAVE_SCALING
            ),
            damage: Math.min(
                Math.pow(SCALING_FACTORS.DAMAGE, waveIndex),
                GameConfig.BALANCE.MAX_WAVE_SCALING
            )
        };
    },
    
    /**
     * Calculates adjusted power-up price with wave inflation and stacking
     * 
     * Prices increase over time to maintain economic balance as players
     * earn more coins. Stacking multiplier makes repeated purchases
     * more expensive to encourage build diversity.
     * 
     * @param {string} powerUpName - Name of the power-up (must exist in POWERUP_PRICES)
     * @param {number} wave - Current wave number for inflation calculation
     * @param {number} [stacks=0] - Current number of stacks owned
     * @returns {number} Final price in coins (minimum 1)
     * 
     * @example
     * // Base price calculation
     * const basePrice = GameConfig.DERIVED.getAdjustedPowerUpPrice("Damage Boost", 1, 0);
     * // Returns: 15 coins (base price, no inflation or stacking)
     * 
     * // With inflation and stacking
     * const lateGamePrice = GameConfig.DERIVED.getAdjustedPowerUpPrice("Damage Boost", 10, 3);
     * // Returns: ~31 coins (15 * 1.05^9 * (1 + 3*0.5))
     */
    getAdjustedPowerUpPrice(powerUpName, wave, stacks = 0) {
        const basePrice = GameConfig.POWERUP_PRICES[powerUpName] || 20;
        const waveInflation = Math.pow(GameConfig.BALANCE.COIN_INFLATION_FACTOR, wave - 1);
        const stackMultiplier = 1 + (stacks * GameConfig.ECONOMY.SHOP_STACK_PRICE_MULTIPLIER);
        
        return Math.max(1, Math.floor(basePrice * waveInflation * stackMultiplier));
    },

    /**
     * Selects the best performance profile based on heuristic FPS or device mutator
     * @param {number} averageFps
     * @returns {keyof GameConfig['PERFORMANCE_PROFILES']}
     */
    selectPerformanceProfile(averageFps = 60) {
        if (averageFps >= 50) return 'HIGH';
        if (averageFps >= 30) return 'MEDIUM';
        return 'LOW';
    },

    /**
     * Retrieve wave modifier key for a given wave number
     * Applies repeating pattern every 5 waves beyond wave 5.
     * @param {number} wave
     * @returns {string|null}
     */
    getModifierForWave(wave) {
        if (wave < 6) return null;
        const sequence = ['STORM', 'OVERCLOCK', 'FOG'];
        const index = (wave - 6) % sequence.length;
        return sequence[index];
    },

    /**
     * Resolve run difficulty preset
     * @param {string} difficulty
     * @returns {{label:string, enemyCountMultiplier:number, enemyHealthMultiplier:number, enemySpeedMultiplier:number, enemyDamageMultiplier:number, spawnIntervalMultiplier:number}}
     */
    getDifficultyPreset(difficulty = 'normal') {
        return GameConfig.DIFFICULTY_PRESETS[difficulty] || GameConfig.DIFFICULTY_PRESETS.normal;
    }
};

// Freeze configuration objects to prevent runtime modification
// This ensures game balance remains consistent throughout play
Object.freeze(GameConfig);
Object.freeze(GameConfig.DERIVED);
