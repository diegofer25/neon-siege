import { Enemy } from './Enemy.js';
import { GameConfig } from './config/GameConfig.js';
import { Projectile } from './Projectile.js';
import { playSFX } from './main.js';
import { MathUtils } from './utils/MathUtils.js';

export class Boss extends Enemy {
    constructor(x, y, health, damage, game) {
        super(x, y, GameConfig.BOSS.SPEED, health, damage);
        this.game = game;
        this.setBaseRadius(GameConfig.BOSS.RADIUS);
        this.color = '#ff00ff'; // Bright magenta for the boss
        this.glowColor = '#ff00ff';
        this.isBoss = true;
        this.bossType = 'Classic';
        this.maxHealth = health;

        // Boss-specific properties
        this.attackTimer = 0;
        this.attackCooldown = GameConfig.BOSS.ATTACK_COOLDOWN;
        this.currentAttack = null;
        this.minionSpawnTimer = 0;
        this.minionSpawnCooldown = GameConfig.BOSS.MINION_SPAWN_COOLDOWN;

        this.isCharging = false;
        this.chargeDuration = 500;
        this.chargeTimeRemaining = 0;
    }

    getDifficultyPreset() {
        return this.game?.waveManager?.difficultyPreset || GameConfig.DIFFICULTY_PRESETS.normal;
    }

    getDifficultyDamageMultiplier() {
        return this.getDifficultyPreset().enemyDamageMultiplier || 1;
    }

    update(delta, player) {
        // Override basic enemy movement
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = MathUtils.distance(this.x, this.y, player.x, player.y);

        const speedMultiplier = (this.game && this.game.modifierState && this.game.modifierState.enemySpeedMultiplier)
            ? this.game.modifierState.enemySpeedMultiplier
            : 1;
        const arenaScale = this.game?.getArenaScale?.() || 1;

        // Store previous position for velocity calculation
        this.prevX = this.x;
        this.prevY = this.y;

        const deltaSeconds = delta / 1000;
        if (this.isCharging) {
            this.x += this.vx * deltaSeconds;
            this.y += this.vy * deltaSeconds;
            this.chargeTimeRemaining -= delta;
            if (this.chargeTimeRemaining <= 0) {
                this.isCharging = false;
                this.vx = 0;
                this.vy = 0;
            }
        } else if (distance > 200) { // Keep some distance
            const normalizedDx = dx / distance;
            const normalizedDy = dy / distance;
            const actualSpeed = this.speed * arenaScale * speedMultiplier * deltaSeconds;
            this.x += normalizedDx * actualSpeed;
            this.y += normalizedDy * actualSpeed;
        }
        
        // Calculate velocity in pixels per second for predictive targeting
        if (deltaSeconds > 0) {
            this.vx = (this.x - this.prevX) / deltaSeconds;
            this.vy = (this.y - this.prevY) / deltaSeconds;
        } else {
            this.vx = 0;
            this.vy = 0;
        }


        this.attackTimer += delta;
        this.minionSpawnTimer += delta;

        if (this.attackTimer >= this.attackCooldown) {
            this.chooseAttack();
            this.executeAttack(player);
            this.attackTimer = 0;
        }

        if (this.minionSpawnTimer >= this.minionSpawnCooldown) {
            this.spawnMinions();
            this.minionSpawnTimer = 0;
        }
    }

    chooseAttack() {
        const attacks = ['projectileBurst', 'charge'];
        this.currentAttack = attacks[Math.floor(Math.random() * attacks.length)];
    }

    executeAttack(player) {
        switch (this.currentAttack) {
            case 'projectileBurst':
                this.projectileBurst();
                break;
            case 'charge':
                this.charge(player);
                break;
        }
    }

    projectileBurst() {
        playSFX('boss_attack_projectile_burst');
        const projectileCount = 16;
        const damage = 10 * this.getDifficultyDamageMultiplier();
        for (let i = 0; i < projectileCount; i++) {
            const angle = (Math.PI * 2 / projectileCount) * i;
            const projectile = new Projectile(
                this.x,
                this.y,
                angle,
                damage
            );
            projectile.isEnemyProjectile = true;
            this.game.projectiles.push(projectile);
        }
    }

    charge(player) {
        playSFX('boss_attack_charge_windup');
        const speedMultiplier = (this.game && this.game.modifierState && this.game.modifierState.enemySpeedMultiplier)
            ? this.game.modifierState.enemySpeedMultiplier
            : 1;
        const arenaScale = this.game?.getArenaScale?.() || 1;
        const chargeSpeed = this.speed * 3 * arenaScale * speedMultiplier;
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = MathUtils.distance(this.x, this.y, player.x, player.y);
        if (distance > 0) {
            this.vx = (dx / distance) * chargeSpeed;
            this.vy = (dy / distance) * chargeSpeed;
        }

        this.isCharging = true;
        this.chargeTimeRemaining = this.chargeDuration;
    }

    spawnMinions() {
        playSFX('boss_summon_minions');
        const minionCount = 2;
        const difficultyPreset = this.getDifficultyPreset();
        for (let i = 0; i < minionCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spawnX = this.x + Math.cos(angle) * 100;
            const spawnY = this.y + Math.sin(angle) * 100;
            const minion = Enemy.createFastEnemy(spawnX, spawnY, 1);
            minion.health *= difficultyPreset.enemyHealthMultiplier;
            minion.maxHealth *= difficultyPreset.enemyHealthMultiplier;
            minion.speed *= difficultyPreset.enemySpeedMultiplier;
            minion.damage *= difficultyPreset.enemyDamageMultiplier;
            minion.setGameReference(this.game);
            this.game.enemies.push(minion);
        }
    }

    draw(ctx) {
        // Custom boss drawing
        ctx.save();
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = 20;
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;

        // Pulsating effect
        const pulse = Math.sin(Date.now() / 200) * 5;
        const size = this.radius + pulse;

        ctx.beginPath();
        ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        this.drawBossHealthBar(ctx);
    }

    drawBossHealthBar(ctx) {
        const canvasWidth  = this.game.canvas.logicalWidth  || this.game.canvas.width;
        const canvasHeight = this.game.canvas.logicalHeight || this.game.canvas.height;
        const barWidth  = canvasWidth * 0.6;
        const barHeight = 22;
        const barX = (canvasWidth - barWidth) / 2;
        const barY = canvasHeight - 48;
        const healthPercent = this.health / this.maxHealth;

        // Label above bar
        ctx.fillStyle = '#ff00ff';
        ctx.font = '11px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('BOSS', canvasWidth / 2, barY - 6);

        // Background
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Health fill
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

        // Border
        ctx.strokeStyle = 'rgba(255, 0, 255, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }

}

