/**
 * @fileoverview OverchargePlugin — Gunner passive: every Nth shot deals Nx damage.
 * Provides a player config object consumed by Player.js firing logic.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

export class OverchargePlugin extends BaseSkillPlugin {
	/** @param {number} rank */
	getPlayerConfig(rank) {
		const effect = this.skillConfig.effect;
		return {
			overchargeBurst: {
				interval: effect.shotInterval - effect.intervalReduction * (rank - 1),
				multiplier: effect.damageMultiplier + effect.multiplierPerRank * (rank - 1),
				shotCount: 0,
				active: true,
			},
		};
	}

	/** @param {number} _rank */
	getVisualOverrides(_rank) {
		return {
			glowColor: '#ffff00',
			gunSkin: {
				barrelGlow: '#ffff00',
				muzzleEffect: 'spark',
			},
			overlays: [
				{ type: 'ring', color: '#ffff00', radius: 14, alpha: 0.4, pulse: true },
			],
		};
	}
}
