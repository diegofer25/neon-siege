import { Boss } from '../Boss.js';
import { GameConfig } from '../config/GameConfig.js';
import { Projectile } from '../Projectile.js';
import { playSFX } from '../main.js';
import { MathUtils } from '../utils/MathUtils.js';

// ─── TELEPORTER BOSS ────────────────────────────────────────────────────────
/**
 * Teleporter Boss — blinks to random positions, leaves toxic trail pools,
 * fires aimed shot salvos after each teleport.
 * Unlocked from wave 10+.
 */
export class TeleporterBoss extends Boss {
    constructor(x, y, health, damage, game) {
        super(x, y, health, damage, game);
        const cfg = GameConfig.BOSS.TELEPORTER_BOSS;
        this.color = '#00ff66';
        this.glowColor = '#00ff66';
        this.bossType = 'Teleporter';

        this.teleportCooldown = cfg.TELEPORT_COOLDOWN;
        this.teleportTimer = 0;
        this.salvoCount = cfg.SALVO_COUNT;
        this.pools = []; // {x, y, timer, maxTimer, radius}
        this.poolDuration = cfg.POOL_DURATION;
        this.poolDPS = cfg.POOL_DPS;
        this.poolRadius = cfg.POOL_RADIUS;

        // Teleport flash animation
        this._teleportFlash = 0;
    }

    update(delta, player) {
        const deltaSeconds = delta / 1000;

        // Store previous position
        this.prevX = this.x;
        this.prevY = this.y;

        // Teleport logic
        this.teleportTimer += delta;
        if (this.teleportTimer >= this.teleportCooldown) {
            this._teleport(player);
            this.teleportTimer = 0;
        }

        // Move slowly towards player between teleports
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = MathUtils.distance(this.x, this.y, player.x, player.y);
        const speedMult = (this.game?.modifierState?.enemySpeedMultiplier) || 1;
        const pressureScale = this.game?.getPressureScale?.() || 1;

        if (distance > 250) {
            const actualSpeed = this.speed * 0.5 * pressureScale * speedMult * deltaSeconds;
            this.x += (dx / distance) * actualSpeed;
            this.y += (dy / distance) * actualSpeed;
        }

        // Calculate velocity
        if (deltaSeconds > 0) {
            this.vx = (this.x - this.prevX) / deltaSeconds;
            this.vy = (this.y - this.prevY) / deltaSeconds;
        }

        // Regular attacks
        this.attackTimer += delta;
        if (this.attackTimer >= this.attackCooldown) {
            this.projectileBurst();
            this.attackTimer = 0;
        }

        // Update toxic pools
        this._updatePools(delta, player);

        // Decay teleport flash
        if (this._teleportFlash > 0) this._teleportFlash -= delta;
    }

    _teleport(player) {
        // Leave toxic pool at current position
        this.pools.push({
            x: this.x, y: this.y,
            timer: 0, maxTimer: this.poolDuration,
            radius: this.poolRadius
        });

        playSFX('boss_attack_charge_windup');

        // Teleport to a random position around the player
        const canvasW = this.game.canvas.logicalWidth || this.game.canvas.width;
        const canvasH = this.game.canvas.logicalHeight || this.game.canvas.height;
        const margin = 80;
        const angle = Math.random() * Math.PI * 2;
        const dist = 200 + Math.random() * 150;
        this.x = MathUtils.clamp(player.x + Math.cos(angle) * dist, margin, canvasW - margin);
        this.y = MathUtils.clamp(player.y + Math.sin(angle) * dist, margin, canvasH - margin);

        this._teleportFlash = 300;

        // Fire aimed salvo after teleport
        this._fireSalvo(player);
        this.game.addScreenShake(6, 200);
    }

    _fireSalvo(player) {
        const baseAngle = Math.atan2(player.y - this.y, player.x - this.x);
        const spread = 0.6;
        const damage = 12 * this.getDifficultyDamageMultiplier();
        for (let i = 0; i < this.salvoCount; i++) {
            const angle = baseAngle + (spread * (i - (this.salvoCount - 1) / 2) / (this.salvoCount - 1));
            const p = new Projectile(this.x, this.y, angle, damage);
            p.isEnemyProjectile = true;
            p.speed = GameConfig.BOSS.PROJECTILE_SPEED * 1.3;
            this.game.projectiles.push(p);
        }
    }

    _updatePools(delta, player) {
        for (let i = this.pools.length - 1; i >= 0; i--) {
            const pool = this.pools[i];
            pool.timer += delta;
            if (pool.timer >= pool.maxTimer) {
                this.pools.splice(i, 1);
                continue;
            }
            // Damage player if standing in pool
            const dist = MathUtils.distance(pool.x, pool.y, player.x, player.y);
            if (dist < pool.radius + player.radius) {
                const dmg = this.poolDPS * this.getDifficultyDamageMultiplier() * (delta / 1000);
                player.takeDamage(dmg);
            }
        }
    }

    draw(ctx) {
        ctx.save();

        // Draw toxic pools
        for (const pool of this.pools) {
            const alpha = 1 - pool.timer / pool.maxTimer;
            ctx.globalAlpha = alpha * 0.35;
            ctx.fillStyle = '#00ff66';
            ctx.shadowColor = '#00ff66';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(pool.x, pool.y, pool.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Teleport flash
        if (this._teleportFlash > 0) {
            ctx.globalAlpha = this._teleportFlash / 300;
            ctx.fillStyle = '#00ff66';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 30, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Draw boss body
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = 20;
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        const pulse = Math.sin(Date.now() / 180) * 4;
        const size = this.radius + pulse;
        ctx.beginPath();
        ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Diamond inner pattern
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        const r = size * 0.55;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - r);
        ctx.lineTo(this.x + r, this.y);
        ctx.lineTo(this.x, this.y + r);
        ctx.lineTo(this.x - r, this.y);
        ctx.closePath();
        ctx.stroke();

        ctx.restore();
        this._drawHealthBar(ctx, 'TELEPORTER BOSS', '#00ff66');
    }

    _drawHealthBar(ctx, label, color) {
        const canvasWidth  = this.game.canvas.logicalWidth  || this.game.canvas.width;
        const canvasHeight = this.game.canvas.logicalHeight || this.game.canvas.height;
        const barWidth  = canvasWidth * 0.6;
        const barHeight = 22;
        const barX = (canvasWidth - barWidth) / 2;
        const barY = canvasHeight - 48;
        const healthPercent = this.health / this.maxHealth;

        ctx.fillStyle = color;
        ctx.font = '11px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, canvasWidth / 2, barY - 6);

        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = color;
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
}
