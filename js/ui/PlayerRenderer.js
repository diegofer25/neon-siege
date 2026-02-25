/**
 * @fileoverview PlayerRenderer – all canvas rendering for the Player entity.
 *
 * Extracted from Player.js to keep the entity class focused on game logic.
 * The render function is read-only – it never mutates the player.
 *
 * Usage:
 *   import { renderPlayer, updatePlayerVisualTimers } from './ui/PlayerRenderer.js';
 *   updatePlayerVisualTimers(player, delta);
 *   renderPlayer(ctx, player);
 */

import { GameConfig } from '../config/GameConfig.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Get the current rotation direction (+1 = CCW, -1 = CW).
 * @param {import('../Player.js').Player} p
 * @returns {number}
 */
function _getRotationDirection(p) {
    if (p.targetAngle === null) return 1;
    let diff = p.targetAngle - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff >= 0 ? 1 : -1;
}

// ---------------------------------------------------------------------------
// Visual Timer Update (called from Player.update, not from draw)
// ---------------------------------------------------------------------------

/**
 * Advance all visual-effect timers that drive the rendering auras.
 * Must be called once per frame **before** `renderPlayer()`.
 *
 * @param {import('../Player.js').Player} p
 * @param {number} delta - ms since last frame
 */
export function updatePlayerVisualTimers(p, delta) {
    const vs = p.visualState;
    const auraCfg = GameConfig.VFX.PLAYER_AURAS;

    // Orbit angle for INT sparks and STR wisps
    p._auraOrbitAngle += (auraCfg.INT.ORBIT_SPEED * delta) / 1000;

    // Flash pulse decay
    if (vs.flashTimer > 0) {
        vs.flashTimer = Math.max(0, vs.flashTimer - delta);
    }

    // DEX sweep decay
    if (p._sweepTimer > 0) {
        p._sweepTimer = Math.max(0, p._sweepTimer - delta);
    }

    // Critical Mastery spark timer
    if (vs.learnedSkills.has('gunner_critical_mastery')) {
        p._critSparkTimer += delta;
        if (p._critSparkTimer > auraCfg.SKILL_VFX.CRIT_SPARK_INTERVAL) {
            p._critSparkTimer = 0;
        }
    }

    // Chain Hit lightning flicker
    if (vs.learnedSkills.has('techno_chain_hit') || vs.learnedSkills.has('techno_chain_master')) {
        p._chainFlickerTimer += delta;
        if (p._chainFlickerTimer >= p._chainFlickerNext) {
            p._chainFlickerOn = !p._chainFlickerOn;
            p._chainFlickerTimer = 0;
            const cfg = auraCfg.SKILL_VFX;
            p._chainFlickerNext = p._chainFlickerOn
                ? 80 + Math.random() * 120
                : cfg.CHAIN_FLICKER_MIN + Math.random() * (cfg.CHAIN_FLICKER_MAX - cfg.CHAIN_FLICKER_MIN);
        }
    }

    // LUCK sparkle spawning & lifecycle
    if (vs.luckLevel > 0) {
        const cfg = auraCfg.LUCK;
        if (p._luckSparkles.length < cfg.MAX_SPARKLES && Math.random() < vs.luckLevel * cfg.CHANCE_PER_POINT) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * cfg.SPAWN_RADIUS;
            const life = cfg.MIN_LIFE + Math.random() * (cfg.MAX_LIFE - cfg.MIN_LIFE);
            p._luckSparkles.push({
                x: p.x + Math.cos(angle) * dist,
                y: p.y + Math.sin(angle) * dist,
                life,
                maxLife: life,
            });
        }
        for (let i = p._luckSparkles.length - 1; i >= 0; i--) {
            p._luckSparkles[i].life -= delta;
            if (p._luckSparkles[i].life <= 0) {
                p._luckSparkles.splice(i, 1);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Main Render
// ---------------------------------------------------------------------------

/**
 * Render the player and all associated visual effects onto the canvas.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../Player.js').Player} p
 */
export function renderPlayer(ctx, p) {
    const vs = p.visualState;
    const auraCfg = GameConfig.VFX.PLAYER_AURAS;
    const now = Date.now();

    // ── PRE-BODY: Attribute auras drawn behind the player ──────────────

    // STR radial gradient glow (behind body)
    if (vs.strLevel >= auraCfg.STR.GRADIENT_THRESHOLD) {
        ctx.save();
        const strT = Math.min(vs.strLevel / 50, 1);
        const gradRadius = p.radius + 10 + strT * 18;
        const pulse = 0.5 + 0.5 * Math.sin(now / 400);
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gradRadius);
        gradient.addColorStop(0, `rgba(255, 69, 0, ${0.15 * strT * pulse})`);
        gradient.addColorStop(0.6, `rgba(255, 140, 0, ${0.08 * strT * pulse})`);
        gradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, gradRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // VIT heartbeat pulse ring
    if (vs.vitLevel > 0) {
        ctx.save();
        const vitT = Math.min(vs.vitLevel / 50, 1);
        const cfg = auraCfg.VIT;
        const pulseFreq = cfg.BASE_PULSE_SPEED + vs.vitLevel * cfg.PULSE_SPEED_PER_POINT;
        const pulse = 0.5 + 0.5 * Math.sin(now * pulseFreq);
        const ringRadius = p.radius + cfg.RING_OFFSET + pulse * 4;
        const thickness = cfg.MIN_THICKNESS + vitT * (cfg.MAX_THICKNESS - cfg.MIN_THICKNESS);
        const alpha = cfg.MIN_ALPHA + vitT * (cfg.MAX_ALPHA - cfg.MIN_ALPHA);
        ctx.strokeStyle = cfg.color;
        ctx.lineWidth = thickness;
        ctx.globalAlpha = alpha * pulse;
        ctx.shadowColor = cfg.color;
        ctx.shadowBlur = 6 * vitT;
        ctx.beginPath();
        ctx.arc(p.x, p.y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // INT orbiting sparks
    if (vs.intLevel >= auraCfg.INT.POINTS_PER_SPARK) {
        ctx.save();
        const cfg = auraCfg.INT;
        const sparkCount = Math.min(cfg.MAX_SPARKS, Math.floor(vs.intLevel / cfg.POINTS_PER_SPARK));
        const orbitR = p.radius + cfg.ORBIT_RADIUS;
        const hasTrail = vs.intLevel >= cfg.TRAIL_THRESHOLD;
        for (let i = 0; i < sparkCount; i++) {
            const baseAngle = p._auraOrbitAngle + (Math.PI * 2 / sparkCount) * i;
            const sx = p.x + Math.cos(baseAngle) * orbitR;
            const sy = p.y + Math.sin(baseAngle) * orbitR;
            const color = cfg.colors[i % cfg.colors.length];
            if (hasTrail) {
                const trailAngle = baseAngle - 0.3;
                const tx = p.x + Math.cos(trailAngle) * orbitR;
                const ty = p.y + Math.sin(trailAngle) * orbitR;
                ctx.globalAlpha = 0.25;
                ctx.fillStyle = color;
                ctx.shadowColor = color;
                ctx.shadowBlur = 4;
                ctx.beginPath();
                ctx.arc(tx, ty, 2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // LUCK golden sparkles
    if (p._luckSparkles.length > 0) {
        ctx.save();
        const cfg = auraCfg.LUCK;
        for (const sp of p._luckSparkles) {
            const t = 1 - sp.life / sp.maxLife;
            const scale = 1 - t * 0.5;
            ctx.globalAlpha = 1 - t;
            ctx.fillStyle = cfg.color;
            ctx.shadowColor = cfg.color;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, cfg.SPARKLE_RADIUS * scale, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // ── BODY: Player triangle + glow ──────────────────────────────────

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);

    const glowColor = p.isRotating ? '#ff6d00' : '#ff2dec';
    ctx.shadowColor = glowColor;
    const strGlowBoost = vs.strLevel * auraCfg.STR.GLOW_PER_POINT;
    ctx.shadowBlur = 15 + strGlowBoost;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    let bodyColor = p.isRotating ? '#ff6d00' : '#ff2dec';
    if (vs.flashTimer > 0) {
        const flashT = vs.flashTimer / auraCfg.PURCHASE.FLASH_DURATION;
        bodyColor = flashT > 0.5 ? '#ffffff' : bodyColor;
        ctx.shadowBlur = 15 + strGlowBoost + 20 * flashT;
    }

    // Volatile Kills shimmer
    if (vs.learnedSkills.has('techno_volatile_kills')) {
        const shimmer = 0.9 + 0.1 * Math.sin(now / 1000 * Math.PI * 2 * auraCfg.SKILL_VFX.VOLATILE_SHIMMER_HZ);
        ctx.globalAlpha = shimmer;
    }

    // Elemental Synergy — glow alternates orange/cyan
    if (vs.learnedSkills.has('techno_elemental_synergy')) {
        const cycle = Math.floor(now / auraCfg.SKILL_VFX.SYNERGY_SWAP_INTERVAL) % 2;
        ctx.shadowColor = cycle === 0 ? '#ff8c00' : '#00e5ff';
    }

    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(p.radius, 0);
    ctx.lineTo(-p.radius * 0.7, -p.radius * 0.5);
    ctx.lineTo(-p.radius * 0.7, p.radius * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // ── GUN BARREL with skill-specific visual overlays ─────────────────

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.radius, 0);
    ctx.lineTo(p.radius + 15, 0);
    ctx.stroke();

    // Sharp Rounds
    if (vs.learnedSkills.has('gunner_sharp_rounds')) {
        ctx.save();
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 8;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(p.radius, 0);
        ctx.lineTo(p.radius + 15, 0);
        ctx.stroke();
        ctx.restore();
    }

    // Explosive Rounds
    if (vs.learnedSkills.has('techno_explosive_rounds')) {
        ctx.save();
        ctx.strokeStyle = '#ff8c00';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ff8c00';
        ctx.shadowBlur = 10;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(p.radius + 2, 0);
        ctx.lineTo(p.radius + 15, 0);
        ctx.stroke();
        if (vs.learnedSkills.has('techno_bigger_booms')) {
            ctx.globalAlpha = 0.9;
            ctx.shadowBlur = 14;
            const emberY = Math.sin(now / 150) * 3;
            ctx.fillStyle = '#ff8c00';
            ctx.beginPath();
            ctx.arc(p.radius + 12, emberY, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // Piercing Shots
    if (vs.learnedSkills.has('gunner_piercing')) {
        ctx.save();
        ctx.strokeStyle = '#88ccff';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#88ccff';
        ctx.shadowBlur = 6;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(p.radius + 15, 0);
        ctx.lineTo(p.radius + 28, 0);
        ctx.stroke();
        ctx.restore();
    }

    // Triple Shot
    if (vs.learnedSkills.has('gunner_triple_shot')) {
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 4;
        ctx.globalAlpha = 0.6;
        const tipX = p.radius + 18;
        for (const spreadAngle of [-0.25, 0, 0.25]) {
            ctx.beginPath();
            ctx.arc(tipX * Math.cos(spreadAngle), tipX * Math.sin(spreadAngle), 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // Homing Rounds
    if (vs.learnedSkills.has('gunner_homing')) {
        ctx.save();
        ctx.strokeStyle = '#ff2dec';
        ctx.lineWidth = 1;
        ctx.shadowColor = '#ff2dec';
        ctx.shadowBlur = 6;
        ctx.globalAlpha = 0.5 + 0.2 * Math.sin(now / 300);
        ctx.beginPath();
        ctx.arc(p.radius + 20, 0, 5, 0, Math.PI * 2);
        ctx.stroke();
        for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
            ctx.beginPath();
            ctx.moveTo(p.radius + 20 + Math.cos(a) * 3, Math.sin(a) * 3);
            ctx.lineTo(p.radius + 20 + Math.cos(a) * 7, Math.sin(a) * 7);
            ctx.stroke();
        }
        ctx.restore();
    }

    ctx.restore(); // End body+barrel local transform

    // ── POST-BODY: Attribute auras and skill effects in world space ────

    // STR fire wisps (orbiting)
    if (vs.strLevel >= auraCfg.STR.WISP_THRESHOLD) {
        ctx.save();
        const cfg = auraCfg.STR;
        const wispCount = Math.min(cfg.MAX_WISPS, 1 + Math.floor((vs.strLevel - cfg.WISP_THRESHOLD) / 10));
        const orbitR = p.radius + cfg.ORBIT_RADIUS;
        for (let i = 0; i < wispCount; i++) {
            const wAngle = p._auraOrbitAngle * 0.7 + (Math.PI * 2 / wispCount) * i;
            const wx = p.x + Math.cos(wAngle) * orbitR;
            const wy = p.y + Math.sin(wAngle) * orbitR;
            ctx.globalAlpha = 0.6 + 0.3 * Math.sin(now / 200 + i);
            ctx.fillStyle = i % 2 === 0 ? cfg.color : cfg.colorAlt;
            ctx.shadowColor = cfg.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(wx, wy, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // DEX speed lines when rotating
    if (vs.dexLevel > 0 && p.isRotating) {
        ctx.save();
        const cfg = auraCfg.DEX;
        const lineCount = Math.min(cfg.SPEED_LINES, Math.max(1, Math.floor(vs.dexLevel / 10)));
        const streakLen = 5 + vs.dexLevel * cfg.STREAK_LEN_PER_POINT;
        ctx.strokeStyle = cfg.color;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = cfg.color;
        ctx.shadowBlur = 4;
        const rotDir = _getRotationDirection(p);
        for (let i = 0; i < lineCount; i++) {
            const offset = (Math.PI * 2 / lineCount) * i;
            const startAngle = p.angle + Math.PI + offset + rotDir * 0.3;
            const arcR = p.radius + 8 + i * 2;
            ctx.globalAlpha = 0.3 + 0.3 * (1 - i / lineCount);
            ctx.beginPath();
            ctx.arc(p.x, p.y, arcR, startAngle, startAngle + rotDir * streakLen / arcR);
            ctx.stroke();
        }
        ctx.restore();
    }

    // DEX target sweep arc
    if (vs.dexLevel > 0 && p._sweepTimer > 0) {
        ctx.save();
        const cfg = auraCfg.DEX;
        const t = p._sweepTimer / cfg.SWEEP_DURATION;
        ctx.strokeStyle = cfg.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5 * t;
        ctx.shadowColor = cfg.color;
        ctx.shadowBlur = 6;
        const sweepR = p.radius + 15;
        const fromAngle = p._lastTargetAngle;
        const toAngle = p.angle;
        ctx.beginPath();
        ctx.arc(p.x, p.y, sweepR, Math.min(fromAngle, toAngle), Math.max(fromAngle, toAngle));
        ctx.stroke();
        ctx.restore();
    }

    // Critical Mastery spark
    if (vs.learnedSkills.has('gunner_critical_mastery') && p._critSparkTimer <= auraCfg.SKILL_VFX.CRIT_SPARK_DURATION) {
        ctx.save();
        const sparkT = p._critSparkTimer / auraCfg.SKILL_VFX.CRIT_SPARK_DURATION;
        ctx.fillStyle = '#ff4444';
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 15;
        ctx.globalAlpha = 1 - sparkT;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 + 6 * sparkT, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Chain Hit lightning arcs
    if ((vs.learnedSkills.has('techno_chain_hit') || vs.learnedSkills.has('techno_chain_master')) && p._chainFlickerOn) {
        ctx.save();
        const isChainMaster = vs.learnedSkills.has('techno_chain_master');
        ctx.strokeStyle = isChainMaster ? '#aa44ff' : '#6666ff';
        ctx.lineWidth = isChainMaster ? 2 : 1.5;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = isChainMaster ? 10 : 6;
        ctx.globalAlpha = 0.7;
        const arcCount = isChainMaster ? 3 : 2;
        for (let a = 0; a < arcCount; a++) {
            const baseA = (Math.PI * 2 / arcCount) * a + now * 0.001;
            ctx.beginPath();
            const r1 = p.radius + 6;
            ctx.moveTo(p.x + Math.cos(baseA) * r1, p.y + Math.sin(baseA) * r1);
            for (let seg = 1; seg <= 3; seg++) {
                const segA = baseA + seg * 0.15;
                const segR = r1 + seg * (isChainMaster ? 7 : 5) + (Math.random() - 0.5) * 4;
                ctx.lineTo(p.x + Math.cos(segA) * segR, p.y + Math.sin(segA) * segR);
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    // Meltdown heat haze
    if (vs.learnedSkills.has('techno_meltdown')) {
        ctx.save();
        ctx.strokeStyle = '#ff4500';
        ctx.lineWidth = 1;
        ctx.shadowColor = '#ff4500';
        ctx.shadowBlur = 4;
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(now / 200);
        const hazeR = p.radius + 25;
        for (let s = 0; s < 6; s++) {
            const sAngle = (Math.PI * 2 / 6) * s + now * 0.0008;
            ctx.beginPath();
            ctx.arc(p.x, p.y, hazeR + Math.sin(now / 150 + s) * 3, sAngle, sAngle + 0.4);
            ctx.stroke();
        }
        ctx.restore();
    }

    // Overcharge energy ring
    if (vs.learnedSkills.has('gunner_overcharge') && p.overchargeBurst?.active) {
        ctx.save();
        const chargeT = 0.5 + 0.5 * Math.sin(now / 250);
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 8 * chargeT;
        ctx.globalAlpha = 0.3 + 0.3 * chargeT;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // ── Targeting indicator when rotating ──────────────────────────────

    if (p.isRotating && p.targetAngle !== null && p.currentTarget) {
        ctx.save();
        ctx.strokeStyle = '#ff6d00';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.globalAlpha = 0.7;

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.currentTarget.x, p.currentTarget.y);
        ctx.stroke();

        ctx.strokeStyle = '#ff6d00';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.5;

        const indicatorLength = p.radius + 25;
        const targetX = p.x + Math.cos(p.targetAngle) * indicatorLength;
        const targetY = p.y + Math.sin(p.targetAngle) * indicatorLength;

        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(p.targetAngle) * p.radius,
                   p.y + Math.sin(p.targetAngle) * p.radius);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();

        ctx.restore();
    }

    // ── Shield ─────────────────────────────────────────────────────────

    if (p.hasShield && p.shieldHp > 0) {
        ctx.save();
        ctx.strokeStyle = '#0ff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#0ff';
        ctx.shadowBlur = 10;

        const shieldRadius = p.radius + 10;
        const shieldAlpha = p.shieldHp / p.maxShieldHp;
        ctx.globalAlpha = shieldAlpha * 0.7;

        ctx.beginPath();
        ctx.arc(p.x, p.y, shieldRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    // ── Slow field ─────────────────────────────────────────────────────

    if (p.hasSlowField && p.slowFieldStrength > 0) {
        ctx.save();
        ctx.strokeStyle = '#8f00ff';
        ctx.lineWidth = Math.max(2, p.slowFieldStrength);
        ctx.shadowColor = '#8f00ff';
        ctx.shadowBlur = 5 + p.slowFieldStrength;
        ctx.globalAlpha = 0.2 + (p.slowFieldStrength * 0.05);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.slowFieldRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    // ── Immolation Aura ────────────────────────────────────────────────

    if (p.immolationAura && p.immolationAura.active) {
        ctx.save();

        const pulseIntensity = 0.5 + 0.5 * Math.sin(now / 300);

        const gradient = ctx.createRadialGradient(
            p.x, p.y, 0,
            p.x, p.y, p.immolationAura.range,
        );
        gradient.addColorStop(0, `rgba(255, 69, 0, ${0.3 * pulseIntensity})`);
        gradient.addColorStop(0.5, `rgba(255, 140, 0, ${0.2 * pulseIntensity})`);
        gradient.addColorStop(1, 'rgba(255, 69, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.immolationAura.range, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(255, 69, 0, ${pulseIntensity * 0.8})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ff4500';
        ctx.shadowBlur = 12;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.immolationAura.range, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    // ── Barrier Phase ──────────────────────────────────────────────────

    if (p.barrierPhaseActive) {
        ctx.save();

        const shimmerIntensity = 0.7 + 0.3 * Math.sin(now / 100);
        const barrierRadius = p.radius + 25;

        ctx.strokeStyle = `rgba(255, 255, 255, ${shimmerIntensity})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 20;

        ctx.beginPath();
        ctx.arc(p.x, p.y, barrierRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(200, 200, 255, ${shimmerIntensity * 0.6})`;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, barrierRadius - 8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
}
