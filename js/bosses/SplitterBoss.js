import { Boss } from '../Boss.js';
import { GameConfig } from '../config/GameConfig.js';
import { playSFX } from '../main.js';

// ─── SPLITTER BOSS ──────────────────────────────────────────────────────────
/**
 * Splitter Boss — splits into smaller copies at 50% HP.
 * Each copy can split once more, producing up to 4 mini-bosses.
 * Unlocked from wave 15+.
 */
export class SplitterBoss extends Boss {
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} health
     * @param {number} damage
     * @param {import('../Game.js').Game} game
     * @param {number} generation - 0 = original, 1 = first split, 2 = cannot split further
     */
    constructor(x, y, health, damage, game, generation = 0) {
        super(x, y, health, damage, game);
        const cfg = GameConfig.BOSS.SPLITTER_BOSS;
        this.color = '#ff6600';
        this.glowColor = '#ff6600';
        this.bossType = 'Splitter';

        this.generation = generation;
        this.splitThreshold = cfg.SPLIT_THRESHOLD;
        this.splitCount = cfg.SPLIT_COUNT;
        this.splitScale = cfg.SPLIT_SCALE;
        this._hasSplit = false;

        // Scale radius down per generation
        if (generation > 0) {
            const scale = Math.pow(cfg.SPLIT_SCALE, generation);
            this.setBaseRadius(GameConfig.BOSS.RADIUS * scale);
            // Sub-copies are faster and more aggressive
            this.speed *= cfg.CHILD_SPEED_MULTIPLIER || 1.6;
            this.attackCooldown *= 0.6; // Attack more often
            this._isSubCopy = true;
        }
    }

    update(delta, player) {
        // Use base Boss movement/attacks but with tighter pursuit
        // Override the keep-distance threshold so Splitter gets closer
        const oldUpdate = super.update.bind(this);
        oldUpdate(delta, player);

        // Check split threshold
        if (!this._hasSplit && this.generation < 2 &&
            this.health > 0 && this.health <= this.maxHealth * this.splitThreshold) {
            this._split();
        }
    }

    _split() {
        this._hasSplit = true;
        playSFX('impact_explosion_small');
        this.game.createExplosion(this.x, this.y, 10);
        this.game.addScreenShake(10, 300);

        const newGen = this.generation + 1;
        const childHealth = this.health * 0.7;
        const childDamage = this.damage * 0.9;

        for (let i = 0; i < this.splitCount; i++) {
            const angle = (Math.PI * 2 / this.splitCount) * i + Math.random() * 0.5;
            const dist = 60;
            const sx = this.x + Math.cos(angle) * dist;
            const sy = this.y + Math.sin(angle) * dist;
            const copy = new SplitterBoss(sx, sy, childHealth, childDamage, this.game, newGen);
            copy.maxHealth = childHealth;
            copy.isBoss = true;
            this.game.enemies.push(copy);
        }

        // Kill original after splitting
        this.health = 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = 20;
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;

        const pulse = Math.sin(Date.now() / 200) * 4;
        const size = this.radius + pulse;

        // Hexagonal body
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 3) * i - Math.PI / 6;
            const px = this.x + Math.cos(a) * size;
            const py = this.y + Math.sin(a) * size;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Split-warning indicator when below 65% health and can still split
        if (!this._hasSplit && this.generation < 2 && this.health < this.maxHealth * 0.65) {
            ctx.globalAlpha = 0.4 + Math.sin(Date.now() / 100) * 0.3;
            ctx.strokeStyle = '#ffcc00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, size + 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        ctx.restore();

        // Only the original (generation 0) draws the big health bar
        if (this.generation === 0) {
            this._drawSplitterHealthBar(ctx);
        }
    }

    _drawSplitterHealthBar(ctx) {
        const canvasWidth  = this.game.canvas.logicalWidth  || this.game.canvas.width;
        const canvasHeight = this.game.canvas.logicalHeight || this.game.canvas.height;
        const barWidth  = canvasWidth * 0.6;
        const barHeight = 22;
        const barX = (canvasWidth - barWidth) / 2;
        const barY = canvasHeight - 48;
        const healthPercent = this.health / this.maxHealth;

        ctx.fillStyle = '#ff6600';
        ctx.font = '11px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SPLITTER BOSS', canvasWidth / 2, barY - 6);

        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = '#ff6600';
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
        ctx.strokeStyle = '#ff6600';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
}
