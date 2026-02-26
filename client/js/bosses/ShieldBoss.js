import { Boss } from '../Boss.js';
import { GameConfig } from '../config/GameConfig.js';
import { Projectile } from '../Projectile.js';
import { playSFX } from '../main.js';

/**
 * Shield Boss variant with defensive abilities and unique attack patterns
 */
export class ShieldBoss extends Boss {
    constructor(x, y, health, damage, game) {
        super(x, y, health, damage, game);
        const shieldConfig = GameConfig.BOSS.SHIELD_BOSS;
        
        // Shield Boss specific properties
        this.color = '#00ffff'; // Cyan color for shield boss
        this.glowColor = '#00ffff';
        this.bossType = 'Shield';
        
        // Shield mechanics
        this.maxShield = health * shieldConfig.SHIELD_HEALTH_RATIO;
        this.shield = this.maxShield;
        this.shieldRegenRate = this.maxShield * shieldConfig.SHIELD_REGEN_RATE;
        this.shieldRegenCooldown = shieldConfig.SHIELD_REGEN_COOLDOWN;
        this.lastDamageTime = 0;
        
        // Shield phases
        this.shieldActive = true;
        this.vulnerabilityPhase = false;
        this.vulnerabilityTimer = 0;
        this.vulnerabilityDuration = shieldConfig.VULNERABILITY_DURATION;
        this.maxShieldReactivations = shieldConfig.MAX_SHIELD_REACTIVATIONS;
        this.shieldReactivations = 0;
        
        // Unique attack patterns
        this.laserChargeTimer = 0;
        this.laserChargeDuration = 2000; // 2 second charge time
        this.isChargingLaser = false;
        this.shieldBurstCooldown = shieldConfig.SHIELD_BURST_COOLDOWN;
        this.shieldBurstTimer = 0;

        this._scheduledTimeouts = new Set();
    }

    _schedule(fn, delay) {
        const id = setTimeout(() => {
            this._scheduledTimeouts.delete(id);
            fn();
        }, delay);
        this._scheduledTimeouts.add(id);
        return id;
    }

    _clearScheduledAttacks() {
        for (const id of this._scheduledTimeouts) {
            clearTimeout(id);
        }
        this._scheduledTimeouts.clear();
    }
    
    update(delta, player) {
        // Update shield regeneration
        this.updateShield(delta);
        
        // Override movement - shield boss moves in a circular pattern
        this.circularMovement(delta);
        
        // Handle attack patterns
        this.updateAttacks(delta, player);
        
        // Handle vulnerability phase
        this.updateVulnerabilityPhase(delta);
    }
    
    updateShield(delta) {
        const currentTime = Date.now();
        
        // Regenerate shield if not damaged recently and shield is not full
        if (this.shield < this.maxShield && 
            currentTime - this.lastDamageTime > this.shieldRegenCooldown) {
            this.shield = Math.min(this.maxShield, 
                this.shield + (this.shieldRegenRate * delta / 1000));
        }
        
        // Check if shield is broken
        if (this.shield <= 0 && this.shieldActive) {
            this.shieldActive = false;
            this.vulnerabilityPhase = true;
            this.vulnerabilityTimer = 0;
            playSFX('boss_shield_break');
            // Create shield break explosion effect
            this.game.createExplosion(this.x, this.y, 16);
            this.game.addScreenShake(15, 400);
        }
        
        // Reactivate shield after vulnerability phase
        if (this.vulnerabilityPhase && this.vulnerabilityTimer >= this.vulnerabilityDuration) {
            this.vulnerabilityPhase = false;
            if (this.shieldReactivations < this.maxShieldReactivations) {
                this.shieldReactivations++;
                this.shieldActive = true;
                this.shield = this.maxShield;
                playSFX('boss_shield_up');
            } else {
                this.shieldActive = false;
                this.shield = 0;
            }
        }
    }
    
    /**
     * Circular movement around the center of the screen
     * @param {number} delta - Time since last update in milliseconds
     */
    circularMovement(delta) {
        const canvasWidth = this.game.canvas.logicalWidth || this.game.canvas.width;
        const canvasHeight = this.game.canvas.logicalHeight || this.game.canvas.height;
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        const orbitRadius = 250;
        
        // Store previous position
        this.prevX = this.x;
        this.prevY = this.y;
        
        // Circular movement around center
        const time = Date.now() / 1000;
        const baseSpeed = this.vulnerabilityPhase ? 0.5 : 0.3; // Move faster when vulnerable
        const speedMultiplier = (this.game && this.game.modifierState && this.game.modifierState.enemySpeedMultiplier)
            ? this.game.modifierState.enemySpeedMultiplier
            : 1;
        const speed = baseSpeed * speedMultiplier;
        
        this.x = centerX + Math.cos(time * speed) * orbitRadius;
        this.y = centerY + Math.sin(time * speed) * orbitRadius;
        
        // Calculate velocity
        const deltaSeconds = delta / 1000;
        if (deltaSeconds > 0) {
            this.vx = (this.x - this.prevX) / deltaSeconds;
            this.vy = (this.y - this.prevY) / deltaSeconds;
        }
    }
    
    updateAttacks(delta, player) {
        this.attackTimer += delta;
        this.laserChargeTimer += delta;
        this.shieldBurstTimer += delta;
        
        // Shield burst attack - only when shield is active
        if (this.shieldActive && this.shieldBurstTimer >= this.shieldBurstCooldown) {
            this.shieldBurst();
            this.shieldBurstTimer = 0;
        }
        
        // Laser attack - more frequent when vulnerable
        const laserCooldown = this.vulnerabilityPhase ? 3000 : 5000;
        if (this.laserChargeTimer >= laserCooldown) {
            this.startLaserCharge(player);
            this.laserChargeTimer = 0;
        }
        
        // Execute charged laser
        if (this.isChargingLaser && this.laserChargeTimer >= this.laserChargeDuration) {
            this.fireLaser();
            this.isChargingLaser = false;
            this.laserChargeTimer = 0;
        }
        
        // Regular projectile attacks
        if (this.attackTimer >= this.attackCooldown) {
            this.chooseAttack();
            this.executeAttack(player);
            this.attackTimer = 0;
        }
    }
    
    updateVulnerabilityPhase(delta) {
        if (this.vulnerabilityPhase) {
            this.vulnerabilityTimer += delta;
        }
    }
    
    chooseAttack() {
        const attacks = this.vulnerabilityPhase ? 
            ['projectileBurst', 'spiralShot', 'rapidFire'] : 
            ['projectileBurst', 'spiralShot'];
        this.currentAttack = attacks[Math.floor(Math.random() * attacks.length)];
    }
    
    executeAttack(player) {
        switch (this.currentAttack) {
            case 'projectileBurst':
                this.projectileBurst();
                break;
            case 'spiralShot':
                this.spiralShot();
                break;
            case 'rapidFire':
                this.rapidFire(player);
                break;
        }
    }
    
    spiralShot() {
        const projectileCount = 8;
        const spiralOffset = (Date.now() / 100) % (Math.PI * 2);
        const damage = 15 * this.getDifficultyDamageMultiplier();
        
        for (let i = 0; i < projectileCount; i++) {
            const angle = (Math.PI * 2 / projectileCount) * i + spiralOffset;
            const projectile = new Projectile(
                this.x,
                this.y,
                angle,
                damage
            );
            projectile.isEnemyProjectile = true;
            projectile.speed = GameConfig.BOSS.PROJECTILE_SPEED * 0.8; // Slower but more damage
            this.game.projectiles.push(projectile);
        }
    }
    
    rapidFire(player) {
        const projectileCount = 5;
        const baseAngle = Math.atan2(player.y - this.y, player.x - this.x);
        const spread = 0.4; // Spread in radians
        const damage = 12 * this.getDifficultyDamageMultiplier();
        
        for (let i = 0; i < projectileCount; i++) {
            const angle = baseAngle + (spread * (i - 2) / 2);
            const projectile = new Projectile(
                this.x,
                this.y,
                angle,
                damage
            );
            projectile.isEnemyProjectile = true;
            projectile.speed = GameConfig.BOSS.PROJECTILE_SPEED * 1.5; // Faster projectiles
            this.game.projectiles.push(projectile);
        }
    }
    
    shieldBurst() {
        playSFX('impact_explosion_small');
        // Create expanding ring of projectiles
        const rings = 3;
        const projectilesPerRing = 12;
        const damage = 8 * this.getDifficultyDamageMultiplier();
        
        for (let ring = 0; ring < rings; ring++) {
            this._schedule(() => {
                if (this.health <= 0 || this.game.gameState !== 'playing') return;
                for (let i = 0; i < projectilesPerRing; i++) {
                    const angle = (Math.PI * 2 / projectilesPerRing) * i;
                    const projectile = new Projectile(
                        this.x,
                        this.y,
                        angle,
                        damage
                    );
                    projectile.isEnemyProjectile = true;
                    projectile.speed = GameConfig.BOSS.PROJECTILE_SPEED * (0.6 + ring * 0.2);
                    this.game.projectiles.push(projectile);
                }
            }, ring * 300); // 300ms delay between rings
        }
    }
    
    startLaserCharge(player) {
        this.isChargingLaser = true;
        this.laserChargeTimer = 0;
        this.laserTargetX = player.x;
        this.laserTargetY = player.y;
        playSFX('boss_laser_charge');
    }
    
    fireLaser() {
        playSFX('boss_laser_fire');
        // Fire a powerful laser beam
        const laserLength = 800;
        const angle = Math.atan2(this.laserTargetY - this.y, this.laserTargetX - this.x);
        const damage = 20 * this.getDifficultyDamageMultiplier();
        
        // Create multiple projectiles along the laser path
        const projectileCount = 15;
        for (let i = 1; i <= projectileCount; i++) {
            const distance = (laserLength / projectileCount) * i;
            const x = this.x + Math.cos(angle) * distance;
            const y = this.y + Math.sin(angle) * distance;
            
            this._schedule(() => {
                if (this.health <= 0 || this.game.gameState !== 'playing') return;
                const projectile = new Projectile(x, y, angle, damage);
                projectile.isEnemyProjectile = true;
                projectile.speed = 0; // Stationary laser segments
                projectile.maxLifetime = 500; // Short duration
                this.game.projectiles.push(projectile);
            }, i * 50); // Staggered appearance
        }
        
        // Screen shake for laser impact
        this.game.addScreenShake(8, 300);
        playSFX('boss_attack_charge_impact');
    }
    
    takeDamage(damage, projectile = null) {
        damage *= this.game?.getEnemyDamageTakenMultiplier?.() || 1;
        this.lastDamageTime = Date.now();
        
        // Check for Overcharge Burst that ignores shields
        if (projectile && projectile.ignoresShields) {
            this.health = Math.max(0, this.health - damage);
            return;
        }
        
        if (this.shieldActive && this.shield > 0) {
            // Calculate shield damage with Shield Breaker multiplier
            let shieldDamageMultiplier = 1;
            let regenDelayExtension = 0;
            
            if (projectile && projectile.hasShieldBreaker) {
                shieldDamageMultiplier = projectile.shieldBreakerDamage;
                regenDelayExtension = projectile.shieldRegenDelay;
                
                // Extend shield regeneration delay
                this.lastDamageTime = Date.now() + regenDelayExtension;
            }
            
            // Apply enhanced damage to shield
            const enhancedShieldDamage = damage * shieldDamageMultiplier;
            const actualShieldDamage = Math.min(enhancedShieldDamage, this.shield);
            this.shield -= actualShieldDamage;
            
            // Calculate remaining damage after shield absorption
            const remainingDamage = Math.max(0, damage - (actualShieldDamage / shieldDamageMultiplier));
            damage = remainingDamage;
        }
        
        // Remaining damage goes to health
        if (damage > 0) {
            this.health = Math.max(0, this.health - damage);
        }

        if (this.health <= 0) {
            this._clearScheduledAttacks();
        }
    }
    
    draw(ctx) {
        ctx.save();
        
        // Draw shield effect when active
        if (this.shieldActive && this.shield > 0) {
            ctx.shadowColor = this.glowColor;
            ctx.shadowBlur = 30;
            ctx.strokeStyle = this.glowColor;
            ctx.lineWidth = 4;
            
            const shieldRadius = this.radius + 15;
            const shieldAlpha = 0.3 + (this.shield / this.maxShield) * 0.4;
            
            // Shield ring
            ctx.globalAlpha = shieldAlpha;
            ctx.beginPath();
            ctx.arc(this.x, this.y, shieldRadius, 0, Math.PI * 2);
            ctx.stroke();
            
            // Shield hexagon pattern
            ctx.globalAlpha = shieldAlpha * 0.5;
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                const x1 = this.x + Math.cos(angle) * shieldRadius;
                const y1 = this.y + Math.sin(angle) * shieldRadius;
                const x2 = this.x + Math.cos(angle + Math.PI / 3) * shieldRadius;
                const y2 = this.y + Math.sin(angle + Math.PI / 3) * shieldRadius;
                
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        }
        
        ctx.globalAlpha = 1;
        
        // Draw boss body
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = 20;
        ctx.fillStyle = this.vulnerabilityPhase ? '#ff4444' : this.color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        
        // Pulsating effect (slower when shielded)
        const pulseSpeed = this.shieldActive ? 300 : 150;
        const pulse = Math.sin(Date.now() / pulseSpeed) * 5;
        const size = this.radius + pulse;
        
        // Draw main body with geometric pattern
        ctx.beginPath();
        ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Draw inner geometric design
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI / 4) * i;
            const innerRadius = size * 0.3;
            const outerRadius = size * 0.7;
            
            ctx.beginPath();
            ctx.moveTo(
                this.x + Math.cos(angle) * innerRadius,
                this.y + Math.sin(angle) * innerRadius
            );
            ctx.lineTo(
                this.x + Math.cos(angle) * outerRadius,
                this.y + Math.sin(angle) * outerRadius
            );
            ctx.stroke();
        }
        
        // Draw laser charging effect
        if (this.isChargingLaser) {
            const chargeProgress = this.laserChargeTimer / this.laserChargeDuration;
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 3 + chargeProgress * 5;
            ctx.globalAlpha = 0.5 + chargeProgress * 0.5;
            
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.laserTargetX, this.laserTargetY);
            ctx.stroke();
        }
        
        ctx.restore();
        
        this.drawShieldBossHealthBar(ctx);
    }
    
    drawShieldBossHealthBar(ctx) {
        const canvasWidth  = this.game.canvas.logicalWidth  || this.game.canvas.width;
        const canvasHeight = this.game.canvas.logicalHeight || this.game.canvas.height;
        const barWidth  = canvasWidth * 0.6;
        const barHeight = 22;
        const barX = (canvasWidth - barWidth) / 2;
        const barY = canvasHeight - 48;
        const healthPercent = this.health / this.maxHealth;
        const shieldPercent = this.shield / this.maxShield;

        // Label above bar
        const bossText = this.vulnerabilityPhase ? 'SHIELD BOSS - VULNERABLE!' : 'SHIELD BOSS';
        ctx.fillStyle = this.vulnerabilityPhase ? '#ffff00' : '#00ffff';
        ctx.font = '11px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(bossText, canvasWidth / 2, barY - 6);

        // Background
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Health fill
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

        // Shield overlay
        if (this.shieldActive && this.shield > 0) {
            ctx.fillStyle = 'rgba(0, 255, 255, 0.7)';
            ctx.fillRect(barX, barY, barWidth * shieldPercent, barHeight);
        }

        // Border
        ctx.strokeStyle = this.vulnerabilityPhase ? '#ffff00' : '#00ffff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
}
