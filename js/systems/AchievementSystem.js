import { playSFX, createFloatingText } from '../main.js';

const ACHIEVEMENTS = [
    // Kill-based
    { id: 'first_blood',     name: 'First Blood',       desc: 'Kill your first enemy',             icon: '🗡️', check: 'killsThisRun', target: 1 },
    { id: 'centurion',       name: 'Centurion',         desc: 'Kill 100 enemies in one run',       icon: '💯', check: 'killsThisRun', target: 100 },
    { id: 'mass_destruction', name: 'Mass Destruction',  desc: 'Kill 1000 enemies total',           icon: '☠️', check: 'totalKills', target: 1000 },

    // Combo-based
    { id: 'combo_10',        name: 'Combo Starter',     desc: 'Reach a 10-kill combo',             icon: '🔥', check: 'maxCombo', target: 10 },
    { id: 'combo_50',        name: 'Untouchable',       desc: 'Reach a 50-kill combo',             icon: '💥', check: 'maxCombo', target: 50 },

    // Wave-based
    { id: 'wave_10',         name: 'Survivor',          desc: 'Reach wave 10',                     icon: '🌊', check: 'wave', target: 10 },
    { id: 'wave_25',         name: 'Veteran',           desc: 'Reach wave 25',                     icon: '⭐', check: 'wave', target: 25 },
    { id: 'wave_50',         name: 'Legend',             desc: 'Reach wave 50',                     icon: '🏆', check: 'wave', target: 50 },
    { id: 'wave_100',        name: 'Immortal',          desc: 'Reach wave 100',                    icon: '👑', check: 'wave', target: 100 },

    // Progression-based
    { id: 'skilled',         name: 'Quick Learner',     desc: 'Reach level 5 in one run',          icon: '📚', check: 'level', target: 5 },
    { id: 'mastered',        name: 'Master',            desc: 'Reach level 15 in one run',         icon: '🎓', check: 'level', target: 15 },

    // Build-based
    { id: 'full_offense',    name: 'Glass Cannon',      desc: 'Have 5+ skills learned',            icon: '🔫', check: 'skillCount', target: 5 },
    { id: 'ascended',        name: 'Ascended',          desc: 'Pick 3 ascension modifiers',        icon: '⚡', check: 'ascensionCount', target: 3 },

    // Boss-based
    { id: 'boss_slayer',     name: 'Boss Slayer',       desc: 'Defeat your first boss',            icon: '🐉', check: 'bossKills', target: 1 },
    { id: 'shield_cracker',  name: 'Shield Cracker',    desc: 'Defeat a Shield Boss',              icon: '🔨', check: 'shieldBossKills', target: 1 },

    // Difficulty-based
    { id: 'hard_mode_10',    name: 'Masochist',         desc: 'Reach wave 10 on Hard',             icon: '💀', check: 'hardModeWave', target: 10 },

    // Secret
    { id: 'perfectionist',   name: 'Perfectionist',     desc: 'Complete wave 10 at full HP',       icon: '✨', check: 'perfectWave10', target: 1 },
];

const TOAST_DURATION_MS = 3000;

export class AchievementSystem {
    constructor(game) {
        this.game = game;
        this._toastQueue = [];
        this._toastActive = false;
        this._toastTimer = 0;

        // Per-run tracking
        this.killsThisRun = 0;
        this.bossKills = 0;
        this.shieldBossKills = 0;
    }

    getUnlockedAchievements() {
        return this.game.progressionManager.state.achievements || {};
    }

    getAllAchievements() {
        return ACHIEVEMENTS;
    }

    onEnemyKilled(enemy) {
        this.killsThisRun++;

        if (enemy.isBoss) {
            this.bossKills++;
            // Shield boss detection: bosses on waves 20, 40, 60...
            if (this.game.wave % 20 === 0) {
                this.shieldBossKills++;
            }
        }

        this._checkAll();
    }

    onWaveComplete() {
        this._checkAll();
    }

    onSkillLearned() {
        this._checkAll();
    }

    resetForRun() {
        this.killsThisRun = 0;
        this.bossKills = 0;
        this.shieldBossKills = 0;
    }

    update(delta) {
        if (this._toastActive) {
            this._toastTimer -= delta;
            if (this._toastTimer <= 0) {
                this._hideToast();
                this._toastActive = false;
                // Show next in queue
                if (this._toastQueue.length > 0) {
                    this._showToast(this._toastQueue.shift());
                }
            }
        }
    }

    _checkAll() {
        const unlocked = this.getUnlockedAchievements();

        for (const achievement of ACHIEVEMENTS) {
            if (unlocked[achievement.id]) continue;

            const value = this._getCheckValue(achievement.check);
            if (value >= achievement.target) {
                this._unlock(achievement);
            }
        }
    }

    _getCheckValue(check) {
        const game = this.game;
        switch (check) {
            case 'killsThisRun':
                return this.killsThisRun;
            case 'totalKills':
                return (game.progressionManager.state.totalKills || 0) + this.killsThisRun;
            case 'maxCombo':
                return game.comboSystem?.maxStreakThisRun || 0;
            case 'wave':
                return game.wave;
            case 'level':
                return game.skillManager?.level || 0;
            case 'skillCount':
                return game.skillManager?.learnedSkills?.size || 0;
            case 'ascensionCount':
                return game.ascensionSystem?.selectedModifiers?.length || 0;
            case 'bossKills':
                return this.bossKills;
            case 'shieldBossKills':
                return this.shieldBossKills;
            case 'hardModeWave':
                return game.runDifficulty === 'hard' ? game.wave : 0;
            case 'perfectWave10':
                return (game.wave >= 10 && game.player?.hp === game.player?.maxHp) ? 1 : 0;
            default:
                return 0;
        }
    }

    _unlock(achievement) {
        if (!this.game.progressionManager.state.achievements) {
            this.game.progressionManager.state.achievements = {};
        }
        this.game.progressionManager.state.achievements[achievement.id] = true;
        this.game.progressionManager._saveState();

        if (this._toastActive) {
            this._toastQueue.push(achievement);
        } else {
            this._showToast(achievement);
        }
    }

    _showToast(achievement) {
        this._toastActive = true;
        this._toastTimer = TOAST_DURATION_MS;

        const player = this.game?.player;
        const canvas = this.game?.canvas;
        if (player && canvas) {
            const rect = canvas.getBoundingClientRect();
            const canvasWidth = canvas.logicalWidth || canvas.width;
            const canvasHeight = canvas.logicalHeight || canvas.height;
            const textX = player.x * (rect.width / canvasWidth) + rect.left;
            const textY = (player.y - 90) * (rect.height / canvasHeight) + rect.top;
            createFloatingText(`🏆 ${achievement.name}`, textX, textY, 'achievement-unlock');
        }

        const toast = document.getElementById('achievementToast');
        if (!toast) return;

        document.getElementById('achievementIcon').textContent = achievement.icon;
        document.getElementById('achievementName').textContent = achievement.name;
        toast.classList.add('show');

        playSFX('achievement_unlock');
    }

    _hideToast() {
        const toast = document.getElementById('achievementToast');
        if (toast) toast.classList.remove('show');
    }
}
