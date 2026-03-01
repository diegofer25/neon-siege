import { Enemy } from '../Enemy.js';
import { GameConfig } from '../config/GameConfig.js';
import { playSFX } from '../main.js';

/**
 * Healer enemy variant that restores nearby allies periodically.
 */
export class HealerEnemy extends Enemy {
    constructor(x, y, speed, health, damage) {
        super(x, y, speed, health, damage);

        this.isHealer = true;
        this.color = GameConfig.ENEMY.HEALER.HEAL_COLOR;
        this.glowColor = GameConfig.ENEMY.HEALER.HEAL_COLOR;
        this.setBaseRadius(20);

        this.healTimer = GameConfig.ENEMY.HEALER.HEAL_INTERVAL;
        this.healPulseTimer = 0;
    }

    update(delta, player, game = null) {
        super.update(delta, player, game);

        if (this.dying || this.health <= 0 || !game) {
            return;
        }

        this.healTimer -= delta;
        if (this.healPulseTimer > 0) {
            this.healPulseTimer -= delta;
        }

        if (this.healTimer <= 0) {
            this.healTimer = GameConfig.ENEMY.HEALER.HEAL_INTERVAL;

            if (this._healNearbyAllies(game)) {
                this.healPulseTimer = 220;
                playSFX('enemy_heal');

                if (game.createExplosion) {
                    game.createExplosion(this.x, this.y, 4);
                }
            }
        }
    }

    _healNearbyAllies(game) {
        const scale = game?.getEntityScale?.() || 1;
        const healRadius = GameConfig.ENEMY.HEALER.HEAL_RADIUS * scale;
        const healAmountRatio = GameConfig.ENEMY.HEALER.HEAL_AMOUNT;

        let healedAny = false;

        for (const ally of game.enemies) {
            if (ally === this || ally.dying || ally.health <= 0 || ally.isBoss || ally.health >= ally.maxHealth) {
                continue;
            }

            const dx = ally.x - this.x;
            const dy = ally.y - this.y;
            if ((dx * dx) + (dy * dy) > healRadius * healRadius) {
                continue;
            }

            const healAmount = ally.maxHealth * healAmountRatio;
            ally.health = Math.min(ally.maxHealth, ally.health + healAmount);
            healedAny = true;
        }

        return healedAny;
    }

    draw(ctx) {
        super.draw(ctx);

        if (this.dying) {
            return;
        }

        const scale = this.game?.getEntityScale?.() || 1;
        const healRadius = GameConfig.ENEMY.HEALER.HEAL_RADIUS * scale;
        const pulse = this.healPulseTimer > 0
            ? this.healPulseTimer / 220
            : (Math.sin(Date.now() / 350) * 0.2 + 0.25);

        ctx.save();

        ctx.strokeStyle = GameConfig.ENEMY.HEALER.HEAL_COLOR;
        ctx.lineWidth = 2;
        ctx.globalAlpha = Math.max(0.12, pulse * 0.35);
        ctx.beginPath();
        ctx.arc(this.x, this.y, healRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        const plusHalf = this.radius * 0.35;
        ctx.beginPath();
        ctx.moveTo(this.x - plusHalf, this.y);
        ctx.lineTo(this.x + plusHalf, this.y);
        ctx.moveTo(this.x, this.y - plusHalf);
        ctx.lineTo(this.x, this.y + plusHalf);
        ctx.stroke();

        ctx.restore();
    }
}
