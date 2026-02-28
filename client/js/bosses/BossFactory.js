import { Boss } from '../Boss.js';
import { GameConfig } from '../config/GameConfig.js';
import { ShieldBoss } from './ShieldBoss.js';
import { TeleporterBoss } from './TeleporterBoss.js';
import { SplitterBoss } from './SplitterBoss.js';
import { VortexBoss } from './VortexBoss.js';
import { ChronoBoss } from './ChronoBoss.js';

/**
 * Factory function to create the appropriate boss for the current wave.
 * Progressively unlocks boss types as waves advance.
 *
 * @param {import('../Game.js').Game} game
 * @returns {Boss}
 */
export function createBoss(game) {
    const wave = game.wave;
    const difficultyPreset = game.waveManager?.difficultyPreset || GameConfig.DIFFICULTY_PRESETS.normal;
    const healthMultiplier = difficultyPreset.enemyHealthMultiplier || 1;
    const speedMultiplier = difficultyPreset.enemySpeedMultiplier || 1;
    const damageMultiplier = difficultyPreset.enemyDamageMultiplier || 1;
    const health = GameConfig.BOSS.BASE_HEALTH * (1 + (wave / 10) * 0.5) * healthMultiplier;
    const damage = GameConfig.BOSS.BASE_DAMAGE * (1 + (wave / 10) * 0.2) * damageMultiplier;

    const canvasWidth = game.canvas.logicalWidth || game.canvas.width;
    const canvasHeight = game.canvas.logicalHeight || game.canvas.height;

    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const spawnMargin = GameConfig.ENEMY.SPAWN_MARGIN;
    const spawnRadius = Math.max(canvasWidth, canvasHeight) / 2 + spawnMargin;
    const angle = Math.random() * Math.PI * 2;
    const x = centerX + Math.cos(angle) * spawnRadius;
    const y = centerY + Math.sin(angle) * spawnRadius;

    // Fixed boss rotation — each boss wave spawns a specific boss type.
    // Waves: 5→Classic, 10→Shield, 15→Teleporter, 20→Splitter, 25→Vortex, 30→Chrono
    const maxWave = GameConfig.BOSS.MAX_WAVE;
    const interval = GameConfig.BOSS.WAVE_INTERVAL;

    /** @type {Array<[number, typeof Boss]>} Ordered boss roster (wave → class) */
    const BOSS_ROSTER = [
        [interval * 1, Boss],            // Wave 5  – Classic
        [interval * 2, ShieldBoss],      // Wave 10 – Barrier / Shield
        [interval * 3, TeleporterBoss],  // Wave 15 – Teleporter
        [interval * 4, SplitterBoss],    // Wave 20 – Splitter
        [interval * 5, VortexBoss],      // Wave 25 – Vortex
        [maxWave,      ChronoBoss],      // Wave 30 – Chrono (final)
    ];

    let boss;
    const entry = BOSS_ROSTER.find(([w]) => w === wave);
    if (entry) {
        const [, BossClass] = entry;
        boss = new BossClass(x, y, health, damage, game);
    } else {
        // Endless mode (wave > maxWave): pick randomly from the full roster
        const pool = BOSS_ROSTER.map(([, Cls]) => Cls);
        const BossClass = pool[Math.floor(Math.random() * pool.length)];
        boss = new BossClass(x, y, health, damage, game);
    }

    boss.speed *= speedMultiplier;
    return boss;
}
