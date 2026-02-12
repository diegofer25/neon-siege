import { Enemy } from '../Enemy.js';
import { Boss } from '../Boss.js';
import { GameConfig } from '../config/GameConfig.js';
import { playSFX } from '../main.js';

/**
 * Manages wave progression, enemy spawning, and wave completion logic.
 */
export class WaveManager {
    /**
     * Creates a new wave manager instance.
     * @param {import('./../Game.js').Game} game - Reference to the main game instance
     */
    constructor(game) {
        this.game = game;
        this.reset();
    }

    /**
     * Reset wave manager to initial state.
     */
    reset() {
        this.currentWave = 0;
        this.enemiesSpawned = 0;
        this.enemiesKilled = 0;
        this.enemiesToSpawn = 0;
        this.enemySpawnTimer = 0;
        this.enemySpawnInterval = GameConfig.WAVE.BASE_SPAWN_INTERVAL;
        this.waveScaling = { health: 1, speed: 1, damage: 1 };
        this.waveStartTime = 0;
        this.waveComplete = false;
        this.waveCompletionTimer = 0;
        this.isBossWave = false;
    }

    /**
     * Start a new wave with calculated parameters.
     * @param {number} waveNumber - Wave number to start
     */
    startWave(waveNumber) {
        this.currentWave = waveNumber;
        this.waveComplete = false;
        this.enemiesSpawned = 0;
        this.enemiesKilled = 0;
        this.waveCompletionTimer = 0;
        this.waveStartTime = Date.now();
        this.isBossWave = this.currentWave > 0 && this.currentWave % 10 === 0;
        playSFX(this.isBossWave ? 'wave_boss_alert' : 'wave_start');

        // Apply a wave modifier (or none) at the start of each wave.
        // Boss waves intentionally have no modifier to keep tuning simpler.
        let modifierKey = null;
        const modifierKeys = Object.keys(GameConfig.WAVE_MODIFIERS || {});
        if (!this.isBossWave && modifierKeys.length > 0 && Math.random() < 0.25) {
            modifierKey = modifierKeys[Math.floor(Math.random() * modifierKeys.length)];
        }
        this.game.applyWaveModifier(modifierKey);

        const enemyCount = GameConfig.DERIVED.getEnemyCountForWave(this.currentWave);
        // Boss waves are boss-only (regular spawns disabled)
        this.enemiesToSpawn = this.isBossWave ? 0 : enemyCount;
        this.enemySpawnInterval = GameConfig.DERIVED.getSpawnIntervalForWave(this.currentWave);
        this.waveScaling = GameConfig.DERIVED.getScalingForWave(this.currentWave);
        this.enemySpawnTimer = 0;

        if (this.isBossWave) {
            this.spawnBoss();
        }

        if (this.enemiesToSpawn > 0) {
            this.spawnEnemy();
            this.enemiesToSpawn--;
            this.enemiesSpawned++;
        }
    }

    /**
     * Update wave state and handle enemy spawning.
     * @param {number} delta - Time elapsed since last frame
     */
    update(delta) {
        this._handleEnemySpawning(delta);
        this._checkWaveCompletion(delta);
    }

    spawnBoss() {
        const boss = Boss.createBoss(this.game);
        this.game.enemies.push(boss);
        playSFX(boss.bossType === 'Shield' ? 'boss_spawn_shield' : 'boss_spawn_classic');
    }

    /**
     * Spawn a single enemy at the screen perimeter.
     */
    spawnEnemy() {
        const canvasWidth = this.game.canvas.logicalWidth || this.game.canvas.width;
        const canvasHeight = this.game.canvas.logicalHeight || this.game.canvas.height;

        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        const spawnRadius = Math.max(canvasWidth, canvasHeight) / 2 + GameConfig.ENEMY.SPAWN_MARGIN;
        
        const angle = Math.random() * Math.PI * 2;
        const x = centerX + Math.cos(angle) * spawnRadius;
        const y = centerY + Math.sin(angle) * spawnRadius;
        
        // Determine enemy type based on wave progression and percentages
        const random = Math.random();
        let enemy;
        
        if (this.currentWave < 11) {
            // Waves 1-10: Only basic enemies (including boss wave 10)
            enemy = Enemy.createBasicEnemy(x, y, 1);
        } else if (this.currentWave < 21) {
            // Waves 11-20: Basic (80%) and Fast (20%) enemies (after first boss)
            if (random < 0.8) {
                enemy = Enemy.createBasicEnemy(x, y, 1);
            } else {
                enemy = Enemy.createFastEnemy(x, y, 1);
            }
        } else if (this.currentWave < 31) {
            // Wave 21-30: Basic (70%), Fast (15%), Tank (15%) enemies
            if (random < 0.7) {
                enemy = Enemy.createBasicEnemy(x, y, 1);
            } else if (random < 0.85) {
                enemy = Enemy.createFastEnemy(x, y, 1);
            } else {
                enemy = Enemy.createTankEnemy(x, y, 1);
            }
        } else {
            // Wave 31+: Basic (60%), Fast (10%), Tank (10%), Splitter (10%) enemies
            if (random < 0.6) {
                enemy = Enemy.createBasicEnemy(x, y, 1);
            } else if (random < 0.70) {
                enemy = Enemy.createFastEnemy(x, y, 1);
            } else if (random < 0.80) {
                enemy = Enemy.createTankEnemy(x, y, 1);
            } else {
                enemy = Enemy.createSplitterEnemy(x, y, 1);
            }
        }
        
        // Apply wave scaling to the created enemy
        enemy.health *= this.waveScaling.health;
        enemy.maxHealth *= this.waveScaling.health;
        enemy.speed *= this.waveScaling.speed;
        enemy.damage *= this.waveScaling.damage;
        
        // Set game reference for enemies that need it (like splitters)
        enemy.setGameReference(this.game);
        
        this.game.enemies.push(enemy);

        if (this.enemiesSpawned === 0) {
            if (enemy.isSplitter) {
                playSFX('enemy_spawn_splitter');
            } else if (enemy.color === '#f0f') {
                playSFX('enemy_spawn_fast');
            } else if (enemy.color === '#ff0') {
                playSFX('enemy_spawn_tank');
            } else {
                playSFX('enemy_spawn_basic');
            }
        }
    }

    /**
     * Register an enemy kill for wave progress tracking.
     */
    onEnemyKilled() {
        this.enemiesKilled++;
    }

    /**
     * Check if current wave is complete.
     * Wave is complete when all enemies to spawn have been spawned AND
     * no enemies remain (including any splits from splitter enemies).
     * @returns {boolean} True if wave is complete
     */
    isWaveComplete() {
        // Wave is complete when no more enemies to spawn and no enemies on field
        const noMoreSpawns = this.enemiesToSpawn === 0;
        const noEnemiesLeft = this.game.enemies.length === 0;
        
        return noMoreSpawns && noEnemiesLeft;
    }

    /**
     * Calculate coin rewards for completing the current wave.
     * @returns {number} Total coins awarded
     */
    calculateWaveReward() {
        const baseReward = GameConfig.ECONOMY.WAVE_COMPLETION_BASE_COINS;
        const waveBonus = Math.floor(this.currentWave * GameConfig.ECONOMY.WAVE_COMPLETION_WAVE_BONUS);
        
        // Time bonus for quick completion (first 30 seconds)
        const completionTime = Date.now() - this.waveStartTime;
        const timeBonus = completionTime < 30000 ? 3 : 0;
        
        return baseReward + waveBonus + timeBonus;
    }

    /**
     * Handle incremental enemy spawning.
     * @private
     * @param {number} delta - Time elapsed since last frame
     */
    _handleEnemySpawning(delta) {
        if (this.enemiesToSpawn > 0) {
            this.enemySpawnTimer += delta;
            if (this.enemySpawnTimer >= this.enemySpawnInterval) {
                this.spawnEnemy();
                this.enemiesToSpawn--;
                this.enemiesSpawned++;
                this.enemySpawnTimer = -200 + Math.random() * 400; // Add randomness
            }
        }
    }

    /**
     * Check wave completion and handle timing.
     * @private
     * @param {number} delta - Time elapsed since last frame
     */
    _checkWaveCompletion(delta) {
        const waveCompleteNow = this.isWaveComplete();
        if (this.game.traceEnabled && waveCompleteNow && !this.waveComplete) {
            this.game.trace('wave.complete.check.passed', {
                wave: this.currentWave,
                enemiesToSpawn: this.enemiesToSpawn,
                enemiesOnField: this.game.enemies.length,
                enemiesSpawned: this.enemiesSpawned,
                enemiesKilled: this.enemiesKilled,
                waveCompletionTimer: this.waveCompletionTimer
            });
        }

        if (waveCompleteNow && !this.waveComplete) {
            this.waveCompletionTimer += delta;
            
            if (this.waveCompletionTimer >= 1000) { // 1 second delay
                this.waveComplete = true;
                this.game.trace('wave.complete.triggered', {
                    wave: this.currentWave,
                    enemiesToSpawn: this.enemiesToSpawn,
                    enemiesOnField: this.game.enemies.length,
                    enemiesSpawned: this.enemiesSpawned,
                    enemiesKilled: this.enemiesKilled
                });
                this.game.completeWave();
            }
        }
    }
}
