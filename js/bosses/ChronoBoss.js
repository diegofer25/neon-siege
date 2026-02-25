import { Boss } from '../Boss.js';
import { GameConfig } from '../config/GameConfig.js';
import { Projectile } from '../Projectile.js';
import { playSFX } from '../main.js';
import { MathUtils } from '../utils/MathUtils.js';

// ─── CHRONO BOSS (FINAL BOSS) ──────────────────────────────────────────────
/**
 * Chrono Boss — the final boss at wave 30. Alternates between speed burst
 * and slow field phases with combined projectile patterns from other bosses.
 */
export class ChronoBoss extends Boss {
    constructor(x, y, health, damage, game) {
        super(x, y, health * 1.5, damage, game); // 50% more HP for final boss
        this.maxHealth = health * 1.5;
        const cfg = GameConfig.BOSS.CHRONO_BOSS;
        this.color = '#ffcc00';
        this.glowColor = '#ffcc00';
        this.bossType = 'Chrono';
        this.setBaseRadius(GameConfig.BOSS.RADIUS * 1.15); // Slightly larger

        // Phase system
        this.speedPhaseDuration = cfg.SPEED_PHASE_DURATION;
        this.slowPhaseDuration = cfg.SLOW_PHASE_DURATION;
        this.slowFieldFactor = cfg.SLOW_FIELD_FACTOR;
        this.speedBurstFactor = cfg.SPEED_BURST_FACTOR;
        this.comboBurstCount = cfg.COMBO_BURST_COUNT;

        this._phase = 'speed'; // 'speed' or 'slow'
        this._phaseTimer = 0;
        this._playerSlowed = false;

        // Attack rotation
        this._attackIndex = 0;
        this._attacks = ['comboBurst', 'spiralWave', 'chargeSlam', 'rapidSalvo'];
    }

    update(delta, player) {
        const deltaSeconds = delta / 1000;

        this.prevX = this.x;
        this.prevY = this.y;

        // Phase timer
        this._phaseTimer += delta;
        const phaseDuration = this._phase === 'speed' ? this.speedPhaseDuration : this.slowPhaseDuration;
        if (this._phaseTimer >= phaseDuration) {
            this._switchPhase(player);
            this._phaseTimer = 0;
        }

        // Movement
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = MathUtils.distance(this.x, this.y, player.x, player.y);
        const speedMult = (this.game?.modifierState?.enemySpeedMultiplier) || 1;
        const arenaScale = this.game?.getArenaScale?.() || 1;
        const phaseFactor = this._phase === 'speed' ? this.speedBurstFactor : 0.5;
        const keepDist = this._phase === 'speed' ? 120 : 250;

        if (distance > keepDist) {
            const actualSpeed = this.speed * phaseFactor * arenaScale * speedMult * deltaSeconds;
            this.x += (dx / distance) * actualSpeed;
            this.y += (dy / distance) * actualSpeed;
        }

        if (deltaSeconds > 0) {
            this.vx = (this.x - this.prevX) / deltaSeconds;
            this.vy = (this.y - this.prevY) / deltaSeconds;
        }

        // Apply slow field to player during slow phase
        if (this._phase === 'slow') {
            const dist = MathUtils.distance(this.x, this.y, player.x, player.y);
            if (dist < 350) {
                if (!this._playerSlowed) {
                    player._chronoSlowBackup = player.speed;
                    player.speed *= this.slowFieldFactor;
                    this._playerSlowed = true;
                }
            } else if (this._playerSlowed) {
                this._restorePlayerSpeed(player);
            }
        } else if (this._playerSlowed) {
            this._restorePlayerSpeed(player);
        }

        // Attacks — cycle through patterns
        this.attackTimer += delta;
        const cd = this._phase === 'speed' ? this.attackCooldown * 0.6 : this.attackCooldown * 1.2;
        if (this.attackTimer >= cd) {
            this._executePatternAttack(player);
            this.attackTimer = 0;
        }

        // Minion spawning during slow phase
        if (this._phase === 'slow') {
            this.minionSpawnTimer += delta;
            if (this.minionSpawnTimer >= this.minionSpawnCooldown * 1.5) {
                this.spawnMinions();
                this.minionSpawnTimer = 0;
            }
        }
    }

    _switchPhase(player) {
        if (this._playerSlowed) {
            this._restorePlayerSpeed(player);
        }
        this._phase = this._phase === 'speed' ? 'slow' : 'speed';
        playSFX(this._phase === 'speed' ? 'boss_attack_charge_windup' : 'boss_shield_up');
        this.game.addScreenShake(10, 300);
        this.game.createExplosion(this.x, this.y, 8);
    }

    _restorePlayerSpeed(player) {
        if (player._chronoSlowBackup) {
            player.speed = player._chronoSlowBackup;
            delete player._chronoSlowBackup;
        }
        this._playerSlowed = false;
    }

    _executePatternAttack(player) {
        const pattern = this._attacks[this._attackIndex % this._attacks.length];
        this._attackIndex++;

        switch (pattern) {
            case 'comboBurst': this._comboBurst(); break;
            case 'spiralWave': this._spiralWave(); break;
            case 'chargeSlam': this.charge(player); break;
            case 'rapidSalvo': this._rapidSalvo(player); break;
        }
    }

    _comboBurst() {
        playSFX('boss_attack_projectile_burst');
        const count = this.comboBurstCount;
        const damage = 10 * this.getDifficultyDamageMultiplier();
        const offset = Date.now() / 200;
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i + offset;
            const p = new Projectile(this.x, this.y, angle, damage);
            p.isEnemyProjectile = true;
            p.speed = GameConfig.BOSS.PROJECTILE_SPEED;
            this.game.projectiles.push(p);
        }
    }

    _spiralWave() {
        const count = 10;
        const damage = 12 * this.getDifficultyDamageMultiplier();
        const baseAngle = Date.now() / 150;
        for (let i = 0; i < count; i++) {
            const angle = baseAngle + (Math.PI * 2 / count) * i;
            const p = new Projectile(this.x, this.y, angle, damage);
            p.isEnemyProjectile = true;
            p.speed = GameConfig.BOSS.PROJECTILE_SPEED * 0.7;
            this.game.projectiles.push(p);
        }
    }

    _rapidSalvo(player) {
        const baseAngle = Math.atan2(player.y - this.y, player.x - this.x);
        const damage = 14 * this.getDifficultyDamageMultiplier();
        for (let i = 0; i < 7; i++) {
            const angle = baseAngle + (0.08 * (i - 3));
            const p = new Projectile(this.x, this.y, angle, damage);
            p.isEnemyProjectile = true;
            p.speed = GameConfig.BOSS.PROJECTILE_SPEED * 1.4;
            this.game.projectiles.push(p);
        }
    }

    draw(ctx) {
        ctx.save();

        // Draw slow field during slow phase
        if (this._phase === 'slow') {
            const alpha = 0.1 + Math.sin(Date.now() / 400) * 0.05;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#4488ff';
            ctx.beginPath();
            ctx.arc(this.x, this.y, 350, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Draw boss body with phase-based color
        const bodyColor = this._phase === 'speed' ? '#ffcc00' : '#4488ff';
        ctx.shadowColor = bodyColor;
        ctx.shadowBlur = 30;
        ctx.fillStyle = bodyColor;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;

        const pulse = Math.sin(Date.now() / 150) * 6;
        const size = this.radius + pulse;

        ctx.beginPath();
        ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Clock-hand inner pattern
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        const t = Date.now() / 400;
        // Hour hand
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(t) * size * 0.5, this.y + Math.sin(t) * size * 0.5);
        ctx.stroke();
        // Minute hand
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(t * 4) * size * 0.7, this.y + Math.sin(t * 4) * size * 0.7);
        ctx.stroke();

        // Phase indicator text
        ctx.fillStyle = '#fff';
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this._phase === 'speed' ? 'HASTE' : 'SLOW', this.x, this.y - size - 10);

        ctx.restore();
        this._drawChronoHealthBar(ctx);
    }

    _drawChronoHealthBar(ctx) {
        const canvasWidth  = this.game.canvas.logicalWidth  || this.game.canvas.width;
        const canvasHeight = this.game.canvas.logicalHeight || this.game.canvas.height;
        const barWidth  = canvasWidth * 0.6;
        const barHeight = 22;
        const barX = (canvasWidth - barWidth) / 2;
        const barY = canvasHeight - 48;
        const healthPercent = this.health / this.maxHealth;

        const barColor = this._phase === 'speed' ? '#ffcc00' : '#4488ff';
        ctx.fillStyle = barColor;
        ctx.font = '11px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('★ CHRONO BOSS ★', canvasWidth / 2, barY - 6);

        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Dual-tone health bar
        const grad = ctx.createLinearGradient(barX, barY, barX + barWidth * healthPercent, barY);
        grad.addColorStop(0, '#ffcc00');
        grad.addColorStop(1, '#4488ff');
        ctx.fillStyle = grad;
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

        ctx.strokeStyle = barColor;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
}
