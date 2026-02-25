import { playSFX } from '../main.js';
import { vfxHelper } from '../managers/VFXHelper.js';
const createFloatingText = vfxHelper.createFloatingText.bind(vfxHelper);
import { MathUtils } from '../utils/MathUtils.js';

const CHALLENGE_POOL = [
    { id: 'speed_demon',   desc: 'Clear 3 waves in under 20s each',   icon: '⏱️', target: 3,  reward: { coins: 30, tokens: 2 } },
    { id: 'no_damage',     desc: 'Clear a wave without taking damage', icon: '🛡️', target: 1,  reward: { coins: 25, tokens: 2 } },
    { id: 'combo_king',    desc: 'Reach a 25-kill combo',             icon: '🔥', target: 25, reward: { coins: 20, tokens: 1 } },
    { id: 'big_spender',   desc: 'Buy 5 power-ups in one shop visit', icon: '🛒', target: 5,  reward: { coins: 20, tokens: 1 } },
    { id: 'boss_rush',     desc: 'Defeat 2 bosses',                   icon: '🐉', target: 2,  reward: { coins: 40, tokens: 3 } },
    { id: 'sharpshooter',  desc: 'Kill 50 enemies in one wave',       icon: '🎯', target: 50, reward: { coins: 30, tokens: 2 } },
    { id: 'tank_buster',   desc: 'Kill 10 tank enemies',              icon: '💪', target: 10, reward: { coins: 25, tokens: 2 } },
    { id: 'miser',         desc: 'Reach wave 15 without buying',      icon: '💎', target: 15, reward: { coins: 50, tokens: 3 } },
];

const CHALLENGES_PER_RUN = 3;

export class ChallengeSystem {
    constructor(game) {
        this.game = game;
        this.activeChallenges = [];

        // Per-run tracking
        this._fastWaves = 0;
        this._waveStartHp = 0;
        this._waveStartTime = 0;
        this._bossKills = 0;
        this._tankKills = 0;
        this._waveKills = 0;
        this._maxShopPurchases = 0;
        this._totalPurchases = 0;
        this._noPurchaseWave = 0;
    }

    selectChallenges() {
        const shuffled = [...CHALLENGE_POOL].sort(() => Math.random() - 0.5);
        this.activeChallenges = shuffled.slice(0, CHALLENGES_PER_RUN).map(c => ({
            ...c,
            progress: 0,
            completed: false,
        }));

        this._fastWaves = 0;
        this._waveStartHp = 0;
        this._waveStartTime = 0;
        this._bossKills = 0;
        this._tankKills = 0;
        this._waveKills = 0;
        this._maxShopPurchases = 0;
        this._totalPurchases = 0;
        this._noPurchaseWave = 0;
    }

    onWaveStart() {
        this._waveStartHp = this.game.player.hp;
        this._waveStartTime = performance.now();
        this._waveKills = 0;
    }

    onEnemyKilled(enemy) {
        this._waveKills++;

        // Tank detection by color
        if (enemy.color === '#ff0' && !enemy.isBoss) {
            this._tankKills++;
        }

        if (enemy.isBoss) {
            this._bossKills++;
        }

        this._updateProgress();
    }

    onWaveComplete() {
        const elapsed = performance.now() - this._waveStartTime;
        if (elapsed < 20000) {
            this._fastWaves++;
        }

        const noDamage = this.game.player.hp >= this._waveStartHp;
        if (noDamage) {
            this._updateChallengeProgress('no_damage', 1);
        }

        if (this._totalPurchases === 0) {
            this._noPurchaseWave = this.game.wave;
        }

        this._updateProgress();
    }

    onShopPurchase(purchasesThisVisit) {
        this._maxShopPurchases = Math.max(this._maxShopPurchases, purchasesThisVisit);
        this._totalPurchases++;
        this._updateProgress();
    }

    _updateProgress() {
        for (const challenge of this.activeChallenges) {
            if (challenge.completed) continue;

            let value = 0;
            switch (challenge.id) {
                case 'speed_demon':   value = this._fastWaves; break;
                case 'no_damage':     break; // Handled in onWaveComplete
                case 'combo_king':    value = this.game.comboSystem?.maxStreakThisRun || 0; break;
                case 'big_spender':   value = this._maxShopPurchases; break;
                case 'boss_rush':     value = this._bossKills; break;
                case 'sharpshooter':  value = this._waveKills; break;
                case 'tank_buster':   value = this._tankKills; break;
                case 'miser':         value = this._totalPurchases === 0 ? this.game.wave : 0; break;
            }

            if (challenge.id !== 'no_damage') {
                challenge.progress = Math.min(value, challenge.target);
            }

            if (challenge.progress >= challenge.target && !challenge.completed) {
                this._completeChallenge(challenge);
            }
        }
    }

    _updateChallengeProgress(id, value) {
        const challenge = this.activeChallenges.find(c => c.id === id);
        if (!challenge || challenge.completed) return;
        challenge.progress = Math.min(challenge.progress + value, challenge.target);
        if (challenge.progress >= challenge.target) {
            this._completeChallenge(challenge);
        }
    }

    _completeChallenge(challenge) {
        challenge.completed = true;

        const player = this.game?.player;
        const canvas = this.game?.canvas;
        let textX;
        let textY;
        if (player && canvas) {
            const screen = MathUtils.canvasToScreen(canvas, player.x, player.y - 72);
            textX = screen.x;
            textY = screen.y;
        } else {
            const { width, height } = this.game.getLogicalCanvasSize();
            textX = width / 2;
            textY = height / 2;
        }

        createFloatingText(`${challenge.icon} Challenge Complete!`, textX, textY, 'challenge-complete');

        // Award XP + score instead of coins
        const xpReward = (challenge.reward.coins || 0) * 5; // Convert old coin amount to XP
        if (xpReward > 0) this.game.addXP(xpReward);
        this.game.score += (challenge.reward.coins || 0) * 10;
        if (challenge.reward.tokens > 0) {
            this.game.progressionManager._incrementCurrency('LEGACY_TOKENS', challenge.reward.tokens);
            this.game.progressionManager._saveState();
        }

        playSFX('challenge_complete');
        this.game.effectsManager.addScreenShake(6, 300);
    }
}
