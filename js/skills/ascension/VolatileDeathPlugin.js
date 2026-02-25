/**
 * @fileoverview VolatileDeathPlugin — Ascension modifier: enemies explode on death.
 *
 * Event-driven plugin — subscribes to 'enemy:killed'.
 * On enemy death, deals a percentage of the enemy's maxHealth as AoE damage
 * to all enemies within a blast radius.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';
import { MathUtils } from '../../utils/MathUtils.js';

/** Blast radius for death explosions (pixels) */
const DEATH_EXPLOSION_RADIUS = 80;

export class VolatileDeathPlugin extends BaseSkillPlugin {
	constructor(id, skillConfig) {
		super(id, skillConfig);
		/** @type {Set<number>} Guard against recursive chain explosions within a single frame */
		this._explodingIds = new Set();
	}

	getEventListeners() {
		return {
			'enemy:killed': this._onEnemyKilled.bind(this),
		};
	}

	/**
	 * On enemy death: deal AoE damage to nearby enemies.
	 * @param {{ enemy: Object, position: {x:number,y:number} }} payload
	 */
	_onEnemyKilled({ enemy, position }) {
		if (!this.game || !this.active) return;

		// Prevent recursive explosions from chaining infinitely in one frame
		if (this._explodingIds.has(enemy.id)) return;
		this._explodingIds.add(enemy.id);

		// Schedule cleanup for next frame
		queueMicrotask(() => this._explodingIds.delete(enemy.id));

		const e = this.getEffect();
		const dmgPercent = e.deathExplosion || 0.15;
		const damage = enemy.maxHealth * dmgPercent;
		const pos = position || { x: enemy.x, y: enemy.y };

		// Visual explosion
		this.game.effectsManager?.createExplosion(pos.x, pos.y, 8);
		this.game.createExplosionRing?.(pos.x, pos.y, DEATH_EXPLOSION_RADIUS);

		// Deal AoE damage to nearby enemies (skip dying enemies)
		for (const target of this.game.enemies) {
			if (target === enemy || target.dying || target.health <= 0) continue;
			const dist = MathUtils.distance(pos.x, pos.y, target.x, target.y);
			if (dist <= DEATH_EXPLOSION_RADIUS + target.radius) {
				target.takeDamage(damage);
				this.game.effectsManager?.createHitEffect(target.x, target.y);
			}
		}
	}
}
