/**
 * @fileoverview Shared area-of-effect damage utility.
 *
 * Replaces the duplicated AOE damage loop found in Projectile.explode(),
 * VolatileKillsPlugin, MeltdownPlugin, and NeonNovaPlugin.
 */

/**
 * Apply area-of-effect damage to enemies within a radius.
 *
 * @param {Object[]} enemies  - Live enemies array
 * @param {number}   cx       - Blast centre X
 * @param {number}   cy       - Blast centre Y
 * @param {number}   radius   - Blast radius (px)
 * @param {Object}   [opts]
 * @param {number}   [opts.damage=0]          - Flat damage per target
 * @param {boolean}  [opts.falloff=false]      - Linear distance falloff on flat damage
 * @param {function} [opts.calcDamage]         - Custom (enemy, dist) → damage (overrides damage/falloff)
 * @param {Object|null} [opts.excludeEnemy=null] - Enemy reference to skip
 * @param {number|null} [opts.excludeId=null]    - Enemy id to skip
 * @returns {{ enemy: Object, damage: number, distance: number }[]}
 */
export function dealAreaDamage(enemies, cx, cy, radius, opts = {}) {
    const {
        damage = 0,
        falloff = false,
        calcDamage,
        excludeEnemy = null,
        excludeId = null,
    } = opts;

    const radiusSq = radius * radius;
    const hits = [];

    for (const enemy of enemies) {
        if (enemy === excludeEnemy) continue;
        if (excludeId !== null && enemy.id === excludeId) continue;
        if (enemy.dying || enemy.health <= 0) continue;

        const dx = enemy.x - cx;
        const dy = enemy.y - cy;
        const distSq = dx * dx + dy * dy;
        if (distSq > radiusSq) continue;

        const dist = Math.sqrt(distSq);
        let dmg;
        if (calcDamage) {
            dmg = calcDamage(enemy, dist);
        } else {
            dmg = falloff ? damage * (1 - dist / radius) : damage;
        }

        enemy.takeDamage(dmg);
        hits.push({ enemy, damage: dmg, distance: dist });
    }

    return hits;
}
