import { playSFX } from '../main.js';
import { vfxHelper } from '../managers/VFXHelper.js';
import { ActionTypes } from '../state/ActionDispatcher.js';
import { GameConfig } from '../config/GameConfig.js';
const createFloatingText = vfxHelper.createFloatingText.bind(vfxHelper);

const DROP_TABLE = [
    // Common (65%) — score bursts replace coin drops
    { type: 'score', rarity: 'common', weight: 40, amount: () => 25 + Math.floor(Math.random() * 50), label: 'Score Burst' },
    { type: 'score', rarity: 'common', weight: 25, amount: () => 50 + Math.floor(Math.random() * 100), label: 'Score Shower' },

    // Uncommon (25%)
    { type: 'tempBuff', rarity: 'uncommon', weight: 10, buff: 'doubleFireRate', duration: 8000, label: 'Rapid Fire Surge!' },
    { type: 'tempBuff', rarity: 'uncommon', weight: 8, buff: 'doubleDamage', duration: 5000, label: 'Damage Frenzy!' },
    { type: 'heal', rarity: 'uncommon', weight: 7, amount: 0.25, label: 'Health Orb' },

    // Rare (8%)
    { type: 'score', rarity: 'rare', weight: 4, amount: () => 200 + Math.floor(Math.random() * 200), label: 'JACKPOT!' },
    { type: 'tempBuff', rarity: 'rare', weight: 3, buff: 'shield', duration: 10000, label: 'Temp Shield!' },
    { type: 'nuke', rarity: 'rare', weight: 1, damage: 0.5, label: 'NEON NOVA!' },

    // Legendary (2%)
    { type: 'score', rarity: 'legendary', weight: 1, amount: () => 500 + Math.floor(Math.random() * 500), label: 'MEGA JACKPOT!!' },
    { type: 'tempBuff', rarity: 'legendary', weight: 1, buff: 'godMode', duration: 5000, label: 'GOD MODE!!' },
];

const BASE_DROP_CHANCE = 0.08;
const MAX_DROP_CHANCE = 0.15;
const WAVE_DROP_BONUS = 0.001;
const COMBO_TIER_DROP_BONUS = 0.02;

// Ground loot configuration
const LOOT_LIFETIME = 15000;
const LOOT_BLINK_START = 3000;
const LOOT_RADIUS = 12;
const PICKUP_BONUS = 10;
const LOOT_BOB_SPEED = 0.003;
const LOOT_BOB_AMPLITUDE = 2;

const RARITY_COLORS = {
    common: '#ffffff',
    uncommon: '#00ffff',
    rare: '#ffff00',
    legendary: '#ff00ff',
};

export class LootSystem {
    constructor(game) {
        this.game = game;
        this.activeTempBuffs = [];
        this.groundItems = [];
        this._originalFireRateMod = null;
        this._originalDamageMod = null;
    }

    rollForDrop(enemy, comboTier = 0) {
        const waveBonus = Math.min(MAX_DROP_CHANCE - BASE_DROP_CHANCE, this.game.wave * WAVE_DROP_BONUS);
        const comboBonus = comboTier * COMBO_TIER_DROP_BONUS;
        const ascLootMult = this.game.player?._lootChanceMultiplier || 1;
        const dropChance = enemy.isBoss ? 1.0 : Math.min(MAX_DROP_CHANCE + comboBonus, (BASE_DROP_CHANCE + waveBonus + comboBonus) * ascLootMult);

        if (Math.random() > dropChance) return null;
        return this._weightedRandom(DROP_TABLE);
    }

    spawnGroundItem(drop, x, y) {
        this.groundItems.push({
            x,
            y,
            radius: LOOT_RADIUS,
            drop,
            age: 0,
            lifetime: LOOT_LIFETIME,
            alpha: 1,
        });
    }

    applyDrop(drop, x, y) {
        createFloatingText(drop.label, x, y, `loot-${drop.rarity}`);
        playSFX('reward_claim_success');

        switch (drop.type) {
            case 'score': {
                const amount = typeof drop.amount === 'function' ? drop.amount() : drop.amount;
                this.game.score += amount;
                // Dispatch score to store
                if (this.game.dispatcher) {
                    this.game.dispatcher.dispatch({
                        type: ActionTypes.SCORE_ADD,
                        payload: { amount },
                    });
                }
                break;
            }
            case 'heal': {
                const healAmount = this.game.player.maxHp * drop.amount;
                this.game.player.hp = Math.min(this.game.player.maxHp, this.game.player.hp + healAmount);
                // Dispatch heal to store
                if (this.game.dispatcher) {
                    this.game.dispatcher.dispatch({
                        type: ActionTypes.PLAYER_HEAL,
                        payload: { amount: healAmount },
                    });
                }
                break;
            }
            case 'tempBuff':
                this._applyTempBuff(drop);
                break;
            case 'nuke':
                this._nukeAllEnemies(drop.damage);
                break;
        }
    }

    update(delta) {
        for (let i = this.activeTempBuffs.length - 1; i >= 0; i--) {
            const buff = this.activeTempBuffs[i];
            buff.remaining -= delta;
            if (buff.remaining <= 0) {
                this._removeTempBuff(buff);
                this.activeTempBuffs.splice(i, 1);
            }
        }

        // Update ground loot items
        const player = this.game.player;
        const pickupDist = player.radius + LOOT_RADIUS + PICKUP_BONUS;
        const pickupDistSq = pickupDist * pickupDist;

        for (let i = this.groundItems.length - 1; i >= 0; i--) {
            const item = this.groundItems[i];
            item.age += delta;

            // Despawn expired items
            if (item.age >= item.lifetime) {
                const last = this.groundItems.length - 1;
                if (i !== last) this.groundItems[i] = this.groundItems[last];
                this.groundItems.pop();
                continue;
            }

            // Blink warning in final seconds
            const remaining = item.lifetime - item.age;
            if (remaining < LOOT_BLINK_START) {
                const urgency = 1 - remaining / LOOT_BLINK_START;
                const freq = 4 + urgency * 12;
                item.alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(item.age * freq * 0.001 * Math.PI * 2));
            } else {
                item.alpha = 1;
            }

            // Pickup collision — player walks over or projectile hits
            let collected = false;
            const dx = player.x - item.x;
            const dy = player.y - item.y;
            if (dx * dx + dy * dy < pickupDistSq) {
                collected = true;
            } else {
                const projectiles = this.game.projectiles;
                for (let p = projectiles.length - 1; p >= 0; p--) {
                    const proj = projectiles[p];
                    const pdx = proj.x - item.x;
                    const pdy = proj.y - item.y;
                    const dist = proj.radius + LOOT_RADIUS;
                    if (pdx * pdx + pdy * pdy < dist * dist) {
                        collected = true;
                        break;
                    }
                }
            }
            if (collected) {
                this.applyDrop(item.drop, item.x, item.y);
                const last = this.groundItems.length - 1;
                if (i !== last) this.groundItems[i] = this.groundItems[last];
                this.groundItems.pop();
            }
        }
    }

    resetForRun() {
        for (const buff of this.activeTempBuffs) {
            this._removeTempBuff(buff);
        }
        this.activeTempBuffs = [];
        this.groundItems.length = 0;
        this._originalFireRateMod = null;
        this._originalDamageMod = null;
    }

    getActiveBuffs() {
        return this.activeTempBuffs;
    }

    renderGroundItems(ctx) {
        const items = this.groundItems;
        if (items.length === 0) return;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const color = RARITY_COLORS[item.drop.rarity] || RARITY_COLORS.common;
            const bob = Math.sin(item.age * LOOT_BOB_SPEED) * LOOT_BOB_AMPLITUDE;
            const drawY = item.y + bob;

            // Outer glow
            ctx.globalAlpha = item.alpha * 0.15;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(item.x, drawY, LOOT_RADIUS + 4, 0, Math.PI * 2);
            ctx.fill();

            // Main shape
            ctx.globalAlpha = item.alpha;
            this._drawLootShape(ctx, item.drop.type, item.x, drawY, LOOT_RADIUS * 0.7, color);

            // Center dot
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(item.x, drawY, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    }

    _drawLootShape(ctx, type, x, y, size, color) {
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;

        switch (type) {
            case 'score': {
                ctx.beginPath();
                ctx.moveTo(x, y - size);
                ctx.lineTo(x + size * 0.7, y);
                ctx.lineTo(x, y + size);
                ctx.lineTo(x - size * 0.7, y);
                ctx.closePath();
                ctx.fill();
                break;
            }
            case 'heal': {
                const arm = size * 0.3;
                ctx.fillRect(x - arm, y - size, arm * 2, size * 2);
                ctx.fillRect(x - size, y - arm, size * 2, arm * 2);
                break;
            }
            case 'tempBuff': {
                ctx.beginPath();
                for (let j = 0; j < 5; j++) {
                    const angle = -Math.PI / 2 + (j * Math.PI * 2) / 5;
                    const outerX = x + Math.cos(angle) * size;
                    const outerY = y + Math.sin(angle) * size;
                    if (j === 0) ctx.moveTo(outerX, outerY);
                    else ctx.lineTo(outerX, outerY);
                    const innerAngle = angle + Math.PI / 5;
                    ctx.lineTo(x + Math.cos(innerAngle) * size * 0.4, y + Math.sin(innerAngle) * size * 0.4);
                }
                ctx.closePath();
                ctx.fill();
                break;
            }
            case 'nuke': {
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x - size * 0.5, y);
                ctx.lineTo(x + size * 0.5, y);
                ctx.moveTo(x, y - size * 0.5);
                ctx.lineTo(x, y + size * 0.5);
                ctx.stroke();
                break;
            }
            default: {
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    _applyTempBuff(drop) {
        const player = this.game.player;
        let normalizedType = drop.buff;
        let multiplier = null;
        let label = drop.label;
        let icon = '✨';
        let description = '';

        switch (drop.buff) {
            case 'doubleFireRate': {
                normalizedType = 'fireRate';
                multiplier = GameConfig.BALANCE.LOOT_FIRE_RATE_MULTIPLIER;
                label = 'Rapid Fire';
                icon = '⚡';
                description = `Firing speed increased by ${Math.round((multiplier - 1) * 100)}%.`;
                break;
            }
            case 'doubleDamage': {
                normalizedType = 'damage';
                multiplier = GameConfig.BALANCE.LOOT_DAMAGE_MULTIPLIER;
                label = 'Damage Surge';
                icon = '💥';
                description = `Damage increased by ${Math.round((multiplier - 1) * 100)}%.`;
                break;
            }
            case 'shield': {
                normalizedType = 'shield';
                label = 'Temp Shield';
                icon = '🛡️';
                description = 'Temporary barrier absorbs incoming damage.';
                break;
            }
            case 'godMode': {
                normalizedType = 'godMode';
                label = 'God Mode';
                icon = '👑';
                description = 'Temporary invulnerability to all damage.';
                break;
            }
        }

        const existing = this.activeTempBuffs.find((active) => active.type === normalizedType);
        if (existing) {
            existing.remaining = drop.duration;
            existing.duration = drop.duration;
            existing.label = label;
            existing.icon = icon;
            existing.description = description;
            if (multiplier !== null) existing.multiplier = multiplier;

            if (this.game.dispatcher) {
                this.game.dispatcher.dispatch({
                    type: ActionTypes.BUFF_REFRESH,
                    payload: {
                        buff: {
                            ...existing,
                        },
                    },
                });
            }
            return;
        }

        const buff = {
            type: normalizedType,
            remaining: drop.duration,
            duration: drop.duration,
            label,
            icon,
            description,
        };

        switch (normalizedType) {
            case 'fireRate':
                if (this._originalFireRateMod === null) this._originalFireRateMod = player.fireRateMod;
                player.fireRateMod *= GameConfig.BALANCE.LOOT_FIRE_RATE_MULTIPLIER;
                buff.multiplier = GameConfig.BALANCE.LOOT_FIRE_RATE_MULTIPLIER;
                break;
            case 'damage': {
                if (this._originalDamageMod === null) this._originalDamageMod = player.damageMod;
                const nextDamage = player.damageMod * GameConfig.BALANCE.LOOT_DAMAGE_MULTIPLIER;
                player.damageMod = Math.min(nextDamage, GameConfig.BALANCE.MAX_LOOT_DAMAGE_MULTIPLIER);
                buff.multiplier = GameConfig.BALANCE.LOOT_DAMAGE_MULTIPLIER;
                break;
            }
            case 'shield':
                player.hasShield = true;
                player.shieldHp = Math.max(player.shieldHp, 50);
                player.maxShieldHp = Math.max(player.maxShieldHp, 50);
                break;
            case 'godMode':
                player._godModeActive = true;
                break;
        }

        this.activeTempBuffs.push(buff);

        // Dispatch buff to store (source of truth for save/load and ComputedStats)
        if (this.game.dispatcher) {
            this.game.dispatcher.dispatch({
                type: ActionTypes.BUFF_APPLY,
                payload: { buff: { ...buff } },
            });
        }
    }

    _removeTempBuff(buff) {
        const player = this.game.player;
        switch (buff.type) {
            case 'fireRate':
                if (this._originalFireRateMod !== null) {
                    player.fireRateMod = this._originalFireRateMod;
                    this._originalFireRateMod = null;
                }
                break;
            case 'damage':
                if (this._originalDamageMod !== null) {
                    player.damageMod = this._originalDamageMod;
                    this._originalDamageMod = null;
                }
                break;
            case 'godMode':
                player._godModeActive = false;
                break;
        }
    }

    _nukeAllEnemies(damagePercent) {
        const enemies = this.game.enemies;
        for (const enemy of enemies) {
            enemy.health -= enemy.maxHealth * damagePercent;
        }
        this.game.effectsManager.addScreenShake(15, 500);

        const { width, height } = this.game.getLogicalCanvasSize();
        this.game.effectsManager.createExplosion(width / 2, height / 2, 20);
    }

    _weightedRandom(table) {
        const totalWeight = table.reduce((sum, item) => sum + item.weight, 0);
        let roll = Math.random() * totalWeight;
        for (const item of table) {
            roll -= item.weight;
            if (roll <= 0) return item;
        }
        return table[table.length - 1];
    }
}
