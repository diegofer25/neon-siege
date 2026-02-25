/**
 * @fileoverview ChainReactionPlugin — Ascension modifier: critical hits bounce.
 *
 * Event-driven plugin — subscribes to 'enemy:hit'.
 * When a projectile crits, the hit bounces to 1 nearby enemy at reduced damage.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';
import { MathUtils } from '../../utils/MathUtils.js';

/** Search radius for the bounce target (pixels) */
const BOUNCE_SEARCH_RADIUS = 200;

export class ChainReactionPlugin extends BaseSkillPlugin {
	getEventListeners() {
		return {
			'enemy:hit': this._onEnemyHit.bind(this),
		};
	}

	/**
	 * On enemy hit: if it was a crit, bounce to 1 nearby enemy.
	 * @param {{ enemy: Object, projectile: Object, damage: number }} payload
	 */
	_onEnemyHit({ enemy, projectile, damage }) {
		if (!this.game || !this.active) return;

		// Only trigger on critical hits
		if (!projectile?.isCritical) return;

		// Don't bounce a bounce (prevent infinite chains)
		if (projectile._isBounce) return;

		const e = this.getEffect();
		const bounceDamageRatio = e.critBounceDamage || 0.50;
		const bounceDamage = damage * bounceDamageRatio;

		// Find nearest non-dying enemy within range (excluding the hit target)
		let bestTarget = null;
		let bestDist = BOUNCE_SEARCH_RADIUS;

		for (const target of this.game.enemies) {
			if (target === enemy || target.dying || target.health <= 0) continue;
			const dist = MathUtils.distance(enemy.x, enemy.y, target.x, target.y);
			if (dist < bestDist) {
				bestDist = dist;
				bestTarget = target;
			}
		}

		if (!bestTarget) return;

		// Deal bounce damage
		bestTarget.takeDamage(bounceDamage);
		this.game.effectsManager?.createHitEffect(bestTarget.x, bestTarget.y);

		// Visual: draw a quick line effect (chain lightning)
		this.game.effectsManager?.createExplosion(bestTarget.x, bestTarget.y, 4);
	}
}
