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
    if (vs.learnedSkills.has('techno_chain_hit') || vs.learnedSkills.has('techno_lightning_cascade')) {
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
    }

    // VIT heartbeat pulse ring — fake glow replaces shadowBlur
    if (vs.vitLevel > 0) {
        const vitT = Math.min(vs.vitLevel / 50, 1);
        const cfg = auraCfg.VIT;
        const pulseFreq = cfg.BASE_PULSE_SPEED + vs.vitLevel * cfg.PULSE_SPEED_PER_POINT;
        const pulse = 0.5 + 0.5 * Math.sin(now * pulseFreq);
        const ringRadius = p.radius + cfg.RING_OFFSET + pulse * 4;
        const thickness = cfg.MIN_THICKNESS + vitT * (cfg.MAX_THICKNESS - cfg.MIN_THICKNESS);
        const alpha = cfg.MIN_ALPHA + vitT * (cfg.MAX_ALPHA - cfg.MIN_ALPHA);

        // Fake glow: wider semi-transparent stroke behind main ring
        ctx.strokeStyle = cfg.color;
        ctx.lineWidth = thickness + 4 * vitT;
        ctx.globalAlpha = alpha * pulse * 0.3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Main ring
        ctx.lineWidth = thickness;
        ctx.globalAlpha = alpha * pulse;
        ctx.beginPath();
        ctx.arc(p.x, p.y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // INT orbiting sparks — fake glow replaces shadowBlur
    if (vs.intLevel >= auraCfg.INT.POINTS_PER_SPARK) {
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
                ctx.beginPath();
                ctx.arc(tx, ty, 2, 0, Math.PI * 2);
                ctx.fill();
            }
            // Fake glow behind spark
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(sx, sy, 5, 0, Math.PI * 2);
            ctx.fill();
            // Main spark
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // LUCK golden sparkles — fake glow replaces shadowBlur
    if (p._luckSparkles.length > 0) {
        const cfg = auraCfg.LUCK;
        for (let si = 0; si < p._luckSparkles.length; si++) {
            const sp = p._luckSparkles[si];
            const t = 1 - sp.life / sp.maxLife;
            const scale = 1 - t * 0.5;
            const sparkR = cfg.SPARKLE_RADIUS * scale;
            // Fake glow
            ctx.globalAlpha = (1 - t) * 0.3;
            ctx.fillStyle = cfg.color;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, sparkR + 3, 0, Math.PI * 2);
            ctx.fill();
            // Main sparkle
            ctx.globalAlpha = 1 - t;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, sparkR, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ── BODY: Exosuit silhouette + fake glow ────────────────────────

    // Fake glow behind body (performance-friendly, no shadowBlur)
    const glowColor = p.isRotating ? '#ff6d00' : '#ff2dec';
    const strGlowBoost = vs.strLevel * auraCfg.STR.GLOW_PER_POINT;
    const glowRadius = p.radius + 8 + strGlowBoost * 0.3;
    const fakeGlow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius);
    fakeGlow.addColorStop(0, glowColor + '44');     // ~27% alpha center
    fakeGlow.addColorStop(0.5, glowColor + '18');   // ~10% alpha mid
    fakeGlow.addColorStop(1, glowColor + '00');     // transparent edge
    ctx.fillStyle = fakeGlow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);

    // Idle breathing or movement tilt
    const bodyCfg = auraCfg.BODY;
    if (p.isMoving) {
        ctx.scale(1, bodyCfg.MOVE_TILT_SQUISH);
    } else if (!p.isRotating) {
        const breathe = 1 + bodyCfg.IDLE_BREATHE_SCALE * Math.sin(now * bodyCfg.IDLE_BREATHE_SPEED);
        ctx.scale(breathe, breathe);
    }

    let bodyColor = p.isRotating ? '#ff6d00' : '#ff2dec';
    if (vs.flashTimer > 0) {
        const flashT = vs.flashTimer / auraCfg.PURCHASE.FLASH_DURATION;
        bodyColor = flashT > 0.5 ? '#ffffff' : bodyColor;
    }

    // Volatile Kills shimmer
    if (vs.learnedSkills.has('techno_volatile_kills')) {
        const shimmer = 0.9 + 0.1 * Math.sin(now / 1000 * Math.PI * 2 * auraCfg.SKILL_VFX.VOLATILE_SHIMMER_HZ);
        ctx.globalAlpha = shimmer;
    }

    // Elemental Synergy — glow alternates orange/cyan
    let synergyColor = null;
    if (vs.learnedSkills.has('techno_elemental_synergy')) {
        const cycle = Math.floor(now / auraCfg.SKILL_VFX.SYNERGY_SWAP_INTERVAL) % 2;
        synergyColor = cycle === 0 ? '#ff8c00' : '#00e5ff';
    }

    const r = p.radius;

    // ── Soldier body (top-down view) ──────────────────────────────

    // Torso — oval, slightly elongated toward facing direction
    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = synergyColor || '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-r * 0.05, 0, r * 0.58, r * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Legs — two small ellipses at the back
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(-r * 0.38, -r * 0.28, r * 0.22, r * 0.13, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-r * 0.38, r * 0.28, r * 0.22, r * 0.13, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Left arm (non-gun side, upper)
    ctx.beginPath();
    ctx.ellipse(r * 0.05, -r * 0.46, r * 0.26, r * 0.12, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Right arm (gun arm, lower) — reaching forward toward gun
    ctx.beginPath();
    ctx.ellipse(r * 0.18, r * 0.44, r * 0.30, r * 0.13, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Head — front-center circle
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r * 0.44, 0, r * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // ── Inner armor plate detail ───────────────────────────────────
    ctx.strokeStyle = bodyColor === '#ffffff' ? '#cccccc' : '#ffffff';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(r * 0.2, -r * 0.2);
    ctx.lineTo(r * 0.2, r * 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.15, -r * 0.22);
    ctx.lineTo(-r * 0.15, r * 0.22);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // ── Helmet visor ──────────────────────────────────────────────
    ctx.strokeStyle = bodyCfg.VISOR_COLOR;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.8 + 0.2 * Math.sin(now / 600);
    ctx.beginPath();
    ctx.arc(r * 0.44, 0, r * 0.18, -0.65, 0.65);
    ctx.stroke();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = bodyCfg.VISOR_COLOR;
    ctx.beginPath();
    ctx.arc(r * 0.44, 0, r * 0.26, -0.8, 0.8);
    ctx.fill();
    ctx.globalAlpha = 1;

    // ── GUN — held on right side (+y), barrel extending forward ───

    const gunY = r * 0.42;          // offset to right side of body
    const barrelStart = r * 0.52;
    const barrelEnd = barrelStart + 18;

    // Gun body / receiver
    ctx.fillStyle = '#555';
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(r * 0.08, gunY - 3.5, r * 0.46, 7);
    ctx.fill();
    ctx.stroke();

    // Barrel
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(barrelStart, gunY);
    ctx.lineTo(barrelEnd, gunY);
    ctx.stroke();
    // Muzzle cap
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(barrelEnd, gunY - 3.5);
    ctx.lineTo(barrelEnd, gunY + 3.5);
    ctx.stroke();

    // Sharp Rounds
    if (vs.learnedSkills.has('gunner_sharp_rounds')) {
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(barrelStart, gunY - 1.5);
        ctx.lineTo(barrelEnd, gunY - 1.5);
        ctx.moveTo(barrelStart, gunY + 1.5);
        ctx.lineTo(barrelEnd, gunY + 1.5);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // Explosive Rounds
    if (vs.learnedSkills.has('techno_explosive_rounds')) {
        ctx.strokeStyle = '#ff8c00';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(barrelStart + 2, gunY - 1.5);
        ctx.lineTo(barrelEnd, gunY - 1.5);
        ctx.moveTo(barrelStart + 2, gunY + 1.5);
        ctx.lineTo(barrelEnd, gunY + 1.5);
        ctx.stroke();
        if (vs.learnedSkills.has('techno_bigger_booms')) {
            ctx.globalAlpha = 0.9;
            const emberY = gunY + Math.sin(now / 150) * 2;
            ctx.fillStyle = '#ff8c00';
            ctx.beginPath();
            ctx.arc(barrelEnd - 3, emberY, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // Piercing Shots
    if (vs.learnedSkills.has('gunner_piercing')) {
        ctx.strokeStyle = '#88ccff';
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(barrelEnd, gunY - 3);
        ctx.lineTo(barrelEnd + 13, gunY);
        ctx.lineTo(barrelEnd, gunY + 3);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // Triple Shot
    if (vs.learnedSkills.has('gunner_triple_shot')) {
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.6;
        const tipX = barrelEnd + 3;
        for (const spreadAngle of [-0.25, 0, 0.25]) {
            ctx.beginPath();
            ctx.arc(tipX * Math.cos(spreadAngle), gunY + tipX * Math.sin(spreadAngle), 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // Homing Rounds (from Aimbot Overdrive ultimate)
    if (vs.learnedSkills.has('gunner_aimbot_overdrive')) {
        ctx.strokeStyle = '#ff2dec';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5 + 0.2 * Math.sin(now / 300);
        const reticleX = barrelEnd + 5;
        ctx.beginPath();
        ctx.arc(reticleX, gunY, 5, 0, Math.PI * 2);
        ctx.stroke();
        for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
            ctx.beginPath();
            ctx.moveTo(reticleX + Math.cos(a) * 3, gunY + Math.sin(a) * 3);
            ctx.lineTo(reticleX + Math.cos(a) * 7, gunY + Math.sin(a) * 7);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    ctx.restore(); // End body+barrel local transform

    // ── POST-BODY: Attribute auras and skill effects in world space ────
    // All shadowBlur replaced with fake glow (semi-transparent larger shapes)

    // STR fire wisps (orbiting) — fake glow
    if (vs.strLevel >= auraCfg.STR.WISP_THRESHOLD) {
        const cfg = auraCfg.STR;
        const wispCount = Math.min(cfg.MAX_WISPS, 1 + Math.floor((vs.strLevel - cfg.WISP_THRESHOLD) / 10));
        const orbitR = p.radius + cfg.ORBIT_RADIUS;
        for (let i = 0; i < wispCount; i++) {
            const wAngle = p._auraOrbitAngle * 0.7 + (Math.PI * 2 / wispCount) * i;
            const wx = p.x + Math.cos(wAngle) * orbitR;
            const wy = p.y + Math.sin(wAngle) * orbitR;
            const wColor = i % 2 === 0 ? cfg.color : cfg.colorAlt;
            // Fake glow
            ctx.globalAlpha = (0.6 + 0.3 * Math.sin(now / 200 + i)) * 0.3;
            ctx.fillStyle = wColor;
            ctx.beginPath();
            ctx.arc(wx, wy, 6, 0, Math.PI * 2);
            ctx.fill();
            // Main wisp
            ctx.globalAlpha = 0.6 + 0.3 * Math.sin(now / 200 + i);
            ctx.beginPath();
            ctx.arc(wx, wy, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // DEX speed lines when rotating — fake glow
    if (vs.dexLevel > 0 && p.isRotating) {
        const cfg = auraCfg.DEX;
        const lineCount = Math.min(cfg.SPEED_LINES, Math.max(1, Math.floor(vs.dexLevel / 10)));
        const streakLen = 5 + vs.dexLevel * cfg.STREAK_LEN_PER_POINT;
        ctx.strokeStyle = cfg.color;
        const rotDir = _getRotationDirection(p);
        // Fake glow pass
        ctx.lineWidth = 3.5;
        for (let i = 0; i < lineCount; i++) {
            const offset = (Math.PI * 2 / lineCount) * i;
            const startAngle = p.angle + Math.PI + offset + rotDir * 0.3;
            const arcR = p.radius + 8 + i * 2;
            ctx.globalAlpha = (0.3 + 0.3 * (1 - i / lineCount)) * 0.3;
            ctx.beginPath();
            ctx.arc(p.x, p.y, arcR, startAngle, startAngle + rotDir * streakLen / arcR);
            ctx.stroke();
        }
        // Main pass
        ctx.lineWidth = 1.5;
        for (let i = 0; i < lineCount; i++) {
            const offset = (Math.PI * 2 / lineCount) * i;
            const startAngle = p.angle + Math.PI + offset + rotDir * 0.3;
            const arcR = p.radius + 8 + i * 2;
            ctx.globalAlpha = 0.3 + 0.3 * (1 - i / lineCount);
            ctx.beginPath();
            ctx.arc(p.x, p.y, arcR, startAngle, startAngle + rotDir * streakLen / arcR);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    // DEX target sweep arc — fake glow
    if (vs.dexLevel > 0 && p._sweepTimer > 0) {
        const cfg = auraCfg.DEX;
        const t = p._sweepTimer / cfg.SWEEP_DURATION;
        ctx.strokeStyle = cfg.color;
        const sweepR = p.radius + 15;
        const fromAngle = p._lastTargetAngle;
        const toAngle = p.angle;
        const arcStart = Math.min(fromAngle, toAngle);
        const arcEnd = Math.max(fromAngle, toAngle);
        // Fake glow
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.5 * t * 0.3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, sweepR, arcStart, arcEnd);
        ctx.stroke();
        // Main
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5 * t;
        ctx.beginPath();
        ctx.arc(p.x, p.y, sweepR, arcStart, arcEnd);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // Critical Mastery spark — fake glow
    if (vs.learnedSkills.has('gunner_critical_mastery') && p._critSparkTimer <= auraCfg.SKILL_VFX.CRIT_SPARK_DURATION) {
        const sparkT = p._critSparkTimer / auraCfg.SKILL_VFX.CRIT_SPARK_DURATION;
        const sparkR = 4 + 6 * sparkT;
        ctx.fillStyle = '#ff4444';
        // Fake glow
        ctx.globalAlpha = (1 - sparkT) * 0.3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, sparkR + 8, 0, Math.PI * 2);
        ctx.fill();
        // Main spark
        ctx.globalAlpha = 1 - sparkT;
        ctx.beginPath();
        ctx.arc(p.x, p.y, sparkR, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // Chain Hit lightning arcs — fake glow
    if ((vs.learnedSkills.has('techno_chain_hit') || vs.learnedSkills.has('techno_lightning_cascade')) && p._chainFlickerOn) {
        const isChainMaster = vs.learnedSkills.has('techno_lightning_cascade');
        const chainColor = isChainMaster ? '#aa44ff' : '#6666ff';
        ctx.strokeStyle = chainColor;
        ctx.globalAlpha = 0.7;
        const arcCount = isChainMaster ? 3 : 2;
        // Fake glow pass
        ctx.lineWidth = (isChainMaster ? 2 : 1.5) + 3;
        ctx.globalAlpha = 0.7 * 0.25;
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
        // Main pass
        ctx.lineWidth = isChainMaster ? 2 : 1.5;
        ctx.globalAlpha = 0.7;
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
        ctx.globalAlpha = 1;
    }

    // Meltdown heat haze — fake glow
    if (vs.learnedSkills.has('techno_meltdown')) {
        ctx.strokeStyle = '#ff4500';
        const hazeR = p.radius + 25;
        // Fake glow pass
        ctx.lineWidth = 3;
        ctx.globalAlpha = (0.25 + 0.15 * Math.sin(now / 200)) * 0.3;
        for (let s = 0; s < 6; s++) {
            const sAngle = (Math.PI * 2 / 6) * s + now * 0.0008;
            ctx.beginPath();
            ctx.arc(p.x, p.y, hazeR + Math.sin(now / 150 + s) * 3, sAngle, sAngle + 0.4);
            ctx.stroke();
        }
        // Main pass
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(now / 200);
        for (let s = 0; s < 6; s++) {
            const sAngle = (Math.PI * 2 / 6) * s + now * 0.0008;
            ctx.beginPath();
            ctx.arc(p.x, p.y, hazeR + Math.sin(now / 150 + s) * 3, sAngle, sAngle + 0.4);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    // Overcharge energy ring — fake glow
    if (vs.learnedSkills.has('gunner_overcharge') && p.overchargeBurst?.active) {
        const chargeT = 0.5 + 0.5 * Math.sin(now / 250);
        const overR = p.radius + 14;
        ctx.strokeStyle = '#ffff00';
        // Fake glow
        ctx.lineWidth = 3.5;
        ctx.globalAlpha = (0.3 + 0.3 * chargeT) * 0.3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, overR, 0, Math.PI * 2);
        ctx.stroke();
        // Main ring
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.3 + 0.3 * chargeT;
        ctx.beginPath();
        ctx.arc(p.x, p.y, overR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // ── Targeting indicator when rotating (needs save/restore for setLineDash) ──

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

    // ── Shield — fake glow ─────────────────────────────────────────

    if (p.hasShield && p.shieldHp > 0) {
        const shieldRadius = p.radius + 10;
        const shieldAlpha = p.shieldHp / p.maxShieldHp;
        ctx.strokeStyle = '#0ff';
        // Fake glow
        ctx.lineWidth = 5;
        ctx.globalAlpha = shieldAlpha * 0.7 * 0.3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, shieldRadius, 0, Math.PI * 2);
        ctx.stroke();
        // Main ring
        ctx.lineWidth = 3;
        ctx.globalAlpha = shieldAlpha * 0.7;
        ctx.beginPath();
        ctx.arc(p.x, p.y, shieldRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // ── Slow field — fake glow ─────────────────────────────────────

    if (p.hasSlowField && p.slowFieldStrength > 0) {
        ctx.strokeStyle = '#8f00ff';
        const sfAlpha = 0.2 + (p.slowFieldStrength * 0.05);
        // Fake glow
        ctx.lineWidth = Math.max(2, p.slowFieldStrength) + 4;
        ctx.globalAlpha = sfAlpha * 0.3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.slowFieldRadius, 0, Math.PI * 2);
        ctx.stroke();
        // Main
        ctx.lineWidth = Math.max(2, p.slowFieldStrength);
        ctx.globalAlpha = sfAlpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.slowFieldRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // ── Immolation Aura — fake glow ────────────────────────────────

    if (p.immolationAura && p.immolationAura.active) {
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

        // Fake glow ring
        ctx.strokeStyle = `rgba(255, 69, 0, ${pulseIntensity * 0.8})`;
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.immolationAura.range, 0, Math.PI * 2);
        ctx.stroke();
        // Main ring
        ctx.lineWidth = 2;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.immolationAura.range, 0, Math.PI * 2);
        ctx.stroke();
    }

    // ── Barrier Phase — fake glow ──────────────────────────────────

    if (p.barrierPhaseActive) {
        const shimmerIntensity = 0.7 + 0.3 * Math.sin(now / 100);
        const barrierRadius = p.radius + 25;

        // Outer ring fake glow
        ctx.strokeStyle = `rgba(255, 255, 255, ${shimmerIntensity * 0.3})`;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(p.x, p.y, barrierRadius, 0, Math.PI * 2);
        ctx.stroke();
        // Outer ring main
        ctx.strokeStyle = `rgba(255, 255, 255, ${shimmerIntensity})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, barrierRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner ring fake glow
        ctx.strokeStyle = `rgba(200, 200, 255, ${shimmerIntensity * 0.6 * 0.3})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, barrierRadius - 8, 0, Math.PI * 2);
        ctx.stroke();
        // Inner ring main
        ctx.strokeStyle = `rgba(200, 200, 255, ${shimmerIntensity * 0.6})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, barrierRadius - 8, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Final cleanup — ensure no leaked state
    ctx.globalAlpha = 1;
}
