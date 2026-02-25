import { Boss } from '../Boss.js';
import { GameConfig } from '../config/GameConfig.js';
import { playSFX } from '../main.js';
import { MathUtils } from '../utils/MathUtils.js';

// ─── VORTEX BOSS ────────────────────────────────────────────────────────────
/**
 * Vortex Boss — gravitational pull toward center, spawns orbiting mines,
 * expanding shockwave attack.
 * Unlocked from wave 25+.
 */
export class VortexBoss extends Boss {
    constructor(x, y, health, damage, game) {
        super(x, y, health, damage, game);
        const cfg = GameConfig.BOSS.VORTEX_BOSS;
        this.color = '#9900ff';
        this.glowColor = '#9900ff';
        this.bossType = 'Vortex';

        this.pullStrength = cfg.PULL_STRENGTH;
        this.pullRange = cfg.PULL_RANGE;
        this.mineCooldown = cfg.MINE_COOLDOWN;
        this.mineTimer = 0;
        this.mineCount = cfg.MINE_COUNT;
        this.mines = []; // {x, y, angle, orbitRadius, timer}
        this.shockwaveCooldown = cfg.SHOCKWAVE_COOLDOWN;
        this.shockwaveTimer = 0;
        this.activeShockwaves = []; // {radius, maxRadius, speed}

        this._orbitAngle = 0;
    }

    update(delta, player) {
        const deltaSeconds = delta / 1000;

        this.prevX = this.x;
        this.prevY = this.y;

        // Move slowly toward center of arena
        const canvasW = this.game.canvas.logicalWidth || this.game.canvas.width;
        const canvasH = this.game.canvas.logicalHeight || this.game.canvas.height;
        const centerX = canvasW / 2;
        const centerY = canvasH / 2;
        const toCenterDist = MathUtils.distance(this.x, this.y, centerX, centerY);

        const speedMult = (this.game?.modifierState?.enemySpeedMultiplier) || 1;
        const arenaScale = this.game?.getArenaScale?.() || 1;

        if (toCenterDist > 50) {
            const moveSpeed = this.speed * 0.4 * arenaScale * speedMult * deltaSeconds;
            this.x += ((centerX - this.x) / toCenterDist) * moveSpeed;
            this.y += ((centerY - this.y) / toCenterDist) * moveSpeed;
        }

        // Calculate velocity
        if (deltaSeconds > 0) {
            this.vx = (this.x - this.prevX) / deltaSeconds;
            this.vy = (this.y - this.prevY) / deltaSeconds;
        }

        // Gravitational pull on player
        const distToPlayer = MathUtils.distance(this.x, this.y, player.x, player.y);
        if (distToPlayer < this.pullRange && distToPlayer > 0) {
            const pullForce = this.pullStrength * (1 - distToPlayer / this.pullRange) * deltaSeconds;
            const pdx = this.x - player.x;
            const pdy = this.y - player.y;
            player.x += (pdx / distToPlayer) * pullForce;
            player.y += (pdy / distToPlayer) * pullForce;
        }

        // Regular attacks
        this.attackTimer += delta;
        if (this.attackTimer >= this.attackCooldown * 1.2) {
            this.projectileBurst();
            this.attackTimer = 0;
        }

        // Mine spawning
        this.mineTimer += delta;
        if (this.mineTimer >= this.mineCooldown && this.mines.length < this.mineCount) {
            this._spawnMine();
            this.mineTimer = 0;
        }

        // Update orbiting mines
        this._orbitAngle += deltaSeconds * 1.5;
        this._updateMines(delta, player);

        // Shockwave
        this.shockwaveTimer += delta;
        if (this.shockwaveTimer >= this.shockwaveCooldown) {
            this._fireShockwave();
            this.shockwaveTimer = 0;
        }

        // Update shockwaves
        this._updateShockwaves(delta, player);
    }

    _spawnMine() {
        const angle = (Math.PI * 2 / this.mineCount) * this.mines.length;
        this.mines.push({
            angle: angle,
            orbitRadius: 120 + Math.random() * 40,
            timer: 0
        });
        playSFX('boss_summon_minions');
    }

    _updateMines(delta, player) {
        const damage = 15 * this.getDifficultyDamageMultiplier();
        for (let i = this.mines.length - 1; i >= 0; i--) {
            const mine = this.mines[i];
            mine.angle = this._orbitAngle + (Math.PI * 2 / this.mineCount) * i;
            const mx = this.x + Math.cos(mine.angle) * mine.orbitRadius;
            const my = this.y + Math.sin(mine.angle) * mine.orbitRadius;
            mine._renderX = mx;
            mine._renderY = my;

            // Check collision with player
            const dist = MathUtils.distance(mx, my, player.x, player.y);
            if (dist < 20 + player.radius) {
                player.takeDamage(damage);
                this.game.createExplosion(mx, my, 6);
                this.mines.splice(i, 1);
                playSFX('impact_explosion_small');
            }
        }
    }

    _fireShockwave() {
        this.activeShockwaves.push({
            radius: this.radius,
            maxRadius: this.pullRange + 100,
            speed: GameConfig.BOSS.VORTEX_BOSS.SHOCKWAVE_SPEED
        });
        playSFX('boss_attack_charge_impact');
        this.game.addScreenShake(8, 250);
    }

    _updateShockwaves(delta, player) {
        const deltaSeconds = delta / 1000;
        const damage = 10 * this.getDifficultyDamageMultiplier();
        for (let i = this.activeShockwaves.length - 1; i >= 0; i--) {
            const sw = this.activeShockwaves[i];
            sw.radius += sw.speed * deltaSeconds;
            if (sw.radius >= sw.maxRadius) {
                this.activeShockwaves.splice(i, 1);
                continue;
            }
            // Check if shockwave ring passes through player
            const distToPlayer = MathUtils.distance(this.x, this.y, player.x, player.y);
            if (Math.abs(distToPlayer - sw.radius) < 20 + player.radius) {
                player.takeDamage(damage);
                sw.radius = sw.maxRadius; // Prevent multi-hit
            }
        }
    }

    draw(ctx) {
        ctx.save();

        // Draw gravity field
        const fieldAlpha = 0.08 + Math.sin(Date.now() / 500) * 0.04;
        ctx.globalAlpha = fieldAlpha;
        ctx.fillStyle = '#9900ff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.pullRange, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Draw shockwaves
        for (const sw of this.activeShockwaves) {
            const alpha = 1 - sw.radius / sw.maxRadius;
            ctx.globalAlpha = alpha * 0.6;
            ctx.strokeStyle = '#9900ff';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(this.x, this.y, sw.radius, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Draw mines
        for (const mine of this.mines) {
            if (mine._renderX == null) continue;
            ctx.fillStyle = '#ff3366';
            ctx.shadowColor = '#ff3366';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(mine._renderX, mine._renderY, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Draw boss body
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = 25;
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        const pulse = Math.sin(Date.now() / 250) * 5;
        const size = this.radius + pulse;
        ctx.beginPath();
        ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Swirl inner pattern
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        const t = Date.now() / 600;
        for (let i = 0; i < 3; i++) {
            const a = t + (Math.PI * 2 / 3) * i;
            ctx.beginPath();
            ctx.arc(this.x, this.y, size * 0.55, a, a + Math.PI * 0.6);
            ctx.stroke();
        }

        ctx.restore();
        this._drawVortexHealthBar(ctx);
    }

    _drawVortexHealthBar(ctx) {
        const canvasWidth  = this.game.canvas.logicalWidth  || this.game.canvas.width;
        const canvasHeight = this.game.canvas.logicalHeight || this.game.canvas.height;
        const barWidth  = canvasWidth * 0.6;
        const barHeight = 22;
        const barX = (canvasWidth - barWidth) / 2;
        const barY = canvasHeight - 48;
        const healthPercent = this.health / this.maxHealth;

        ctx.fillStyle = '#9900ff';
        ctx.font = '11px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('VORTEX BOSS', canvasWidth / 2, barY - 6);

        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = '#9900ff';
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
        ctx.strokeStyle = '#9900ff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
}
