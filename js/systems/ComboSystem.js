import { playSFX } from '../main.js';
import { vfxHelper } from '../managers/VFXHelper.js';
const createFloatingText = vfxHelper.createFloatingText.bind(vfxHelper);
import { MathUtils } from '../utils/MathUtils.js';

const COMBO_TIERS = [
    { kills: 5,  label: 'COMBO x5',       multiplier: 1.25, bonusScore: 50,   color: '#fff' },
    { kills: 10, label: 'STREAK x10!',    multiplier: 1.5,  bonusScore: 150,  color: '#0ff' },
    { kills: 20, label: 'RAMPAGE x20!',   multiplier: 2.0,  bonusScore: 300,  color: '#ff0' },
    { kills: 35, label: 'UNSTOPPABLE!',   multiplier: 2.5,  bonusScore: 600,  color: '#f0f' },
    { kills: 50, label: 'GOD MODE!!',     multiplier: 3.0,  bonusScore: 1200, color: '#ff2dec' },
];

const COMBO_TIMEOUT_MS = 2000;
const COMBO_BREAK_SFX_MIN_STREAK = 10;

export class ComboSystem {
    constructor(game) {
        this.game = game;
        this.currentStreak = 0;
        this.comboTimer = 0;
        this.comboTier = 0;
        this.maxStreakThisWave = 0;
        this.maxStreakThisRun = 0;
        this.totalBonusScore = 0;
    }

    onEnemyKilled() {
        this.currentStreak++;
        this.comboTimer = 0;

        if (this.currentStreak > this.maxStreakThisWave) {
            this.maxStreakThisWave = this.currentStreak;
        }
        if (this.currentStreak > this.maxStreakThisRun) {
            this.maxStreakThisRun = this.currentStreak;
        }

        const newTier = this._calculateTier();
        if (newTier > this.comboTier) {
            this.comboTier = newTier;
            const tier = COMBO_TIERS[newTier - 1];
            this._onTierReached(tier);
        }

        return this.getScoreMultiplier();
    }

    update(delta) {
        if (this.currentStreak > 0) {
            this.comboTimer += delta;
            if (this.comboTimer >= COMBO_TIMEOUT_MS) {
                this.breakCombo();
            }
        }
    }

    breakCombo() {
        const streakBeforeBreak = this.currentStreak;
        if (streakBeforeBreak >= 5) {
            const { x, y } = this._getPlayerTextScreenPosition(38);
            createFloatingText('Combo Ended', x, y, 'combo-break');
        }
        if (streakBeforeBreak >= COMBO_BREAK_SFX_MIN_STREAK) {
            playSFX('combo_break');
        }
        this.currentStreak = 0;
        this.comboTier = 0;
        this.comboTimer = 0;
    }

    getScoreMultiplier() {
        const tier = this._calculateTier();
        if (tier === 0) return 1.0;
        return COMBO_TIERS[tier - 1].multiplier;
    }

    getTimerProgress() {
        if (this.currentStreak === 0) return 0;
        return Math.max(0, 1 - (this.comboTimer / COMBO_TIMEOUT_MS));
    }

    getCurrentTierInfo() {
        if (this.comboTier === 0) return null;
        return COMBO_TIERS[this.comboTier - 1];
    }

    resetForWave() {
        this.maxStreakThisWave = 0;
        this.breakCombo();
    }

    resetForRun() {
        this.maxStreakThisRun = 0;
        this.totalBonusScore = 0;
        this.resetForWave();
    }

    _calculateTier() {
        for (let i = COMBO_TIERS.length - 1; i >= 0; i--) {
            if (this.currentStreak >= COMBO_TIERS[i].kills) {
                return i + 1;
            }
        }
        return 0;
    }

    _onTierReached(tier) {
        const { x, y } = this._getPlayerTextScreenPosition(64);
        createFloatingText(tier.label, x, y, 'combo-tier');

        // Award bonus score instead of coins
        this.game.score += tier.bonusScore;
        this.totalBonusScore += tier.bonusScore;
        const { x: sx, y: sy } = this._getPlayerTextScreenPosition(38);
        createFloatingText(`+${tier.bonusScore} score`, sx, sy, 'score');

        this.game.effectsManager.addScreenShake(4 + this.comboTier * 2, 200);
        playSFX(this._getTierSfxKey());
    }

    _getTierSfxKey() {
        if (this.comboTier >= 5) return 'combo_tier_max';
        if (this.comboTier >= 3) return 'combo_tier_high';
        if (this.comboTier >= 2) return 'combo_tier_mid';
        return 'combo_tier_low';
    }

    _getPlayerTextScreenPosition(offsetY = 40) {
        const player = this.game?.player;
        const canvas = this.game?.canvas;
        if (!player || !canvas) {
            const { width, height } = this.game.getLogicalCanvasSize();
            return { x: width / 2, y: height / 2 };
        }

        const screen = MathUtils.canvasToScreen(canvas, player.x, player.y - offsetY);
        return { x: screen.x, y: screen.y };
    }
}
