import { playSFX } from '../main.js';
import { vfxHelper } from '../managers/VFXHelper.js';
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

export class LootSystem {
    constructor(game) {
        this.game = game;
        this.activeTempBuffs = [];
        this._originalFireRateMod = null;
        this._originalDamageMod = null;
    }

    rollForDrop(enemy, comboTier = 0) {
        const waveBonus = Math.min(MAX_DROP_CHANCE - BASE_DROP_CHANCE, this.game.wave * WAVE_DROP_BONUS);
        const comboBonus = comboTier * COMBO_TIER_DROP_BONUS;
        const dropChance = enemy.isBoss ? 1.0 : Math.min(MAX_DROP_CHANCE + comboBonus, BASE_DROP_CHANCE + waveBonus + comboBonus);

        if (Math.random() > dropChance) return null;
        return this._weightedRandom(DROP_TABLE);
    }

    applyDrop(drop, x, y) {
        createFloatingText(drop.label, x, y, `loot-${drop.rarity}`);
        playSFX('reward_claim_success');

        switch (drop.type) {
            case 'score': {
                const amount = typeof drop.amount === 'function' ? drop.amount() : drop.amount;
                this.game.score += amount;
                break;
            }
            case 'heal': {
                const healAmount = this.game.player.maxHp * drop.amount;
                this.game.player.hp = Math.min(this.game.player.maxHp, this.game.player.hp + healAmount);
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
    }

    resetForRun() {
        for (const buff of this.activeTempBuffs) {
            this._removeTempBuff(buff);
        }
        this.activeTempBuffs = [];
        this._originalFireRateMod = null;
        this._originalDamageMod = null;
    }

    getActiveBuffs() {
        return this.activeTempBuffs;
    }

    _applyTempBuff(drop) {
        const player = this.game.player;
        const buff = { type: drop.buff, remaining: drop.duration, duration: drop.duration };

        switch (drop.buff) {
            case 'doubleFireRate':
                if (this._originalFireRateMod === null) this._originalFireRateMod = player.fireRateMod;
                player.fireRateMod *= 2;
                break;
            case 'doubleDamage':
                if (this._originalDamageMod === null) this._originalDamageMod = player.damageMod;
                player.damageMod *= 2;
                break;
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
    }

    _removeTempBuff(buff) {
        const player = this.game.player;
        switch (buff.type) {
            case 'doubleFireRate':
                if (this._originalFireRateMod !== null) {
                    player.fireRateMod = this._originalFireRateMod;
                    this._originalFireRateMod = null;
                }
                break;
            case 'doubleDamage':
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
