import { createBoss } from '../bosses/BossFactory.js';
import { GameConfig } from '../config/GameConfig.js';
import { createBasicEnemy, createFastEnemy, createTankEnemy, createSplitterEnemy, createHealerEnemy } from '../enemies/EnemyFactory.js';
import { playSFX } from '../main.js';
import { voiceManager } from '../managers/VoiceManager.js';
import { ActionTypes } from '../state/ActionDispatcher.js';

/** Map bossType string → voice key. */
const BOSS_VOICE_MAP = {
    Classic:    'boss_intro_classic',
    Shield:     'boss_intro_shield',
    Teleporter: 'boss_intro_teleporter',
    Splitter:   'boss_intro_splitter',
    Vortex:     'boss_intro_vortex',
    Chrono:     'boss_intro_chrono',
};

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
        this.waveActive = false;
        this.isBossWave = false;
        this.difficultyPreset = GameConfig.DIFFICULTY_PRESETS.normal;
    }

    setDifficulty(difficulty = 'normal') {
        this.difficultyPreset = GameConfig.DERIVED.getDifficultyPreset(difficulty);
    }

    /**
     * Start a new wave with calculated parameters.
     * @param {number} waveNumber - Wave number to start
     */
    startWave(waveNumber) {
        this.currentWave = waveNumber;
        this.waveComplete = false;
        this.waveActive = true;
        this.enemiesSpawned = 0;
        this.enemiesKilled = 0;
        this.waveCompletionTimer = 0;
        this.waveStartTime = Date.now();
        this.isBossWave = this.currentWave > 0 && this.currentWave % GameConfig.BOSS.WAVE_INTERVAL === 0;
        playSFX(this.isBossWave ? 'wave_boss_alert' : 'wave_start');

        // Emit wave:started event for skill plugins
        this.game.eventBus.emit('wave:started', { wave: waveNumber });

        // Apply a wave modifier (or none) at the start of each wave.
        // Boss waves intentionally have no modifier to keep tuning simpler.
        let modifierKey = null;
        const modifierKeys = Object.keys(GameConfig.WAVE_MODIFIERS || {});
        if (!this.isBossWave && modifierKeys.length > 0 && Math.random() < 0.25) {
            modifierKey = modifierKeys[Math.floor(Math.random() * modifierKeys.length)];
        }
        this.game.applyWaveModifier(modifierKey);

        const enemyCount = GameConfig.DERIVED.getEnemyCountForWave(this.currentWave);
        const adjustedEnemyCount = Math.max(1, Math.floor(enemyCount * this.difficultyPreset.enemyCountMultiplier));
        // Boss waves 5/10/15 are boss-only; wave 20+ spawn boss AND a regular enemy wave
        this.enemiesToSpawn = (this.isBossWave && this.currentWave < 20) ? 0 : adjustedEnemyCount;
        this.enemySpawnInterval = Math.max(
            GameConfig.WAVE.MIN_SPAWN_INTERVAL,
            GameConfig.DERIVED.getSpawnIntervalForWave(this.currentWave) * this.difficultyPreset.spawnIntervalMultiplier
        );
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
        const boss = createBoss(this.game);
        this.game.enemies.push(boss);
        // Use shield-specific SFX for ShieldBoss, otherwise generic boss spawn
        playSFX(boss.bossType === 'Shield' ? 'boss_spawn_shield' : 'boss_spawn_classic');

        // Voice-over callout for the boss type
        const voiceKey = BOSS_VOICE_MAP[boss.bossType];
        if (voiceKey) voiceManager.play(voiceKey);
    }

    /**
     * Spawn a single enemy at the screen perimeter.
     */
    spawnEnemy() {
        const canvasWidth = this.game.canvas.logicalWidth || this.game.canvas.width;
        const canvasHeight = this.game.canvas.logicalHeight || this.game.canvas.height;

        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        const spawnMargin = GameConfig.ENEMY.SPAWN_MARGIN;
        const spawnRadius = Math.max(canvasWidth, canvasHeight) / 2 + spawnMargin;
        
        const angle = Math.random() * Math.PI * 2;
        const x = centerX + Math.cos(angle) * spawnRadius;
        const y = centerY + Math.sin(angle) * spawnRadius;
        
        // Determine enemy type based on wave progression and percentages
        const random = Math.random();
        let enemy;
        
        if (this.currentWave < 6) {
            // Waves 1-5: Only basic enemies
            enemy = createBasicEnemy(x, y, 1);
        } else if (this.currentWave < 11) {
            // Waves 6-10: Basic (80%) and Fast (20%) enemies
            if (random < 0.8) {
                enemy = createBasicEnemy(x, y, 1);
            } else {
                enemy = createFastEnemy(x, y, 1);
            }
        } else if (this.currentWave < 15) {
            // Waves 11-14: Basic (65%), Fast (20%), Tank (15%)
            if (random < 0.65) {
                enemy = createBasicEnemy(x, y, 1);
            } else if (random < 0.85) {
                enemy = createFastEnemy(x, y, 1);
            } else {
                enemy = createTankEnemy(x, y, 1);
            }
        } else if (this.currentWave < 21) {
            // Waves 15-20: Basic (55%), Fast (15%), Tank (15%), Healer (15%)
            if (random < 0.55) {
                enemy = createBasicEnemy(x, y, 1);
            } else if (random < 0.70) {
                enemy = createFastEnemy(x, y, 1);
            } else if (random < 0.85) {
                enemy = createTankEnemy(x, y, 1);
            } else {
                enemy = createHealerEnemy(x, y, 1);
            }
        } else {
            // Waves 21-30+: Basic (45%), Fast (15%), Tank (15%), Healer (10%), Splitter (15%)
            if (random < 0.45) {
                enemy = createBasicEnemy(x, y, 1);
            } else if (random < 0.60) {
                enemy = createFastEnemy(x, y, 1);
            } else if (random < 0.75) {
                enemy = createTankEnemy(x, y, 1);
            } else if (random < 0.85) {
                enemy = createHealerEnemy(x, y, 1);
            } else {
                enemy = createSplitterEnemy(x, y, 1);
            }
        }
        
        // Apply wave scaling to the created enemy
        enemy.health *= this.waveScaling.health * this.difficultyPreset.enemyHealthMultiplier;
        enemy.maxHealth *= this.waveScaling.health * this.difficultyPreset.enemyHealthMultiplier;
        enemy.speed *= this.waveScaling.speed * this.difficultyPreset.enemySpeedMultiplier;
        enemy.damage *= this.waveScaling.damage * this.difficultyPreset.enemyDamageMultiplier;
        
        // Set game reference for enemies that need it (like splitters)
        enemy.setGameReference(this.game);
        
        this.game.enemies.push(enemy);

        // Dispatch enemy spawned to store
        if (this.game.dispatcher) {
            this.game.dispatcher.dispatch({
                type: ActionTypes.ENEMY_SPAWNED,
                payload: { type: enemy.isBoss ? 'boss' : 'normal' },
            });
            this.game.dispatcher.dispatch({
                type: ActionTypes.WAVE_ENEMY_SPAWNED,
                payload: {},
            });
        }

        if (this.enemiesSpawned === 0) {
            if (enemy.isHealer) {
                playSFX('enemy_spawn_healer');
            } else if (enemy.isSplitter) {
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
     * Calculate XP reward for completing the current wave.
     * @returns {number} Total XP awarded
     */
    calculateWaveXP() {
        const base = 10 + this.currentWave * 2;
        // Time bonus for quick completion (first 30 seconds)
        const completionTime = Date.now() - this.waveStartTime;
        const timeBonus = completionTime < 30000 ? 5 : 0;
        return base + timeBonus;
    }

    getSaveSnapshot() {
        return {
            currentWave: this.currentWave,
            enemiesSpawned: this.enemiesSpawned,
            enemiesKilled: this.enemiesKilled,
            enemiesToSpawn: this.enemiesToSpawn,
            enemySpawnTimer: this.enemySpawnTimer,
            enemySpawnInterval: this.enemySpawnInterval,
            waveScaling: this.waveScaling,
            waveStartTime: this.waveStartTime,
            waveComplete: this.waveComplete,
            waveCompletionTimer: this.waveCompletionTimer,
            waveActive: this.waveActive,
            isBossWave: this.isBossWave
        };
    }

    restoreFromSave(snapshot = {}) {
        this.currentWave = snapshot.currentWave || 1;
        this.enemiesSpawned = snapshot.enemiesSpawned || 0;
        this.enemiesKilled = snapshot.enemiesKilled || 0;
        this.enemiesToSpawn = snapshot.enemiesToSpawn || 0;
        this.enemySpawnTimer = snapshot.enemySpawnTimer || 0;
        this.enemySpawnInterval = snapshot.enemySpawnInterval || GameConfig.WAVE.BASE_SPAWN_INTERVAL;
        this.waveScaling = snapshot.waveScaling || GameConfig.DERIVED.getScalingForWave(this.currentWave);
        this.waveStartTime = snapshot.waveStartTime || Date.now();
        this.waveComplete = !!snapshot.waveComplete;
        this.waveCompletionTimer = snapshot.waveCompletionTimer || 0;
        this.waveActive = typeof snapshot.waveActive === 'boolean'
            ? snapshot.waveActive
            : (!this.waveComplete && this.currentWave > 0);
        this.isBossWave = !!snapshot.isBossWave;
    }

    /**
     * Handle incremental enemy spawning.
     * @private
     * @param {number} delta - Time elapsed since last frame
     */
    _handleEnemySpawning(delta) {
        if (this.enemiesToSpawn > 0) {
            this.enemySpawnTimer += delta;
            const pressureScale = this.game.getPressureScale?.() || 1;
            const effectiveInterval = Math.max(
                GameConfig.WAVE.MIN_SPAWN_INTERVAL,
                this.enemySpawnInterval / pressureScale
            );
            if (this.enemySpawnTimer >= effectiveInterval) {
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
        if (!this.waveActive) {
            return;
        }

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
                this.waveActive = false;
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
