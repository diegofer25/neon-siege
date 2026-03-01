/**
 * @fileoverview SharpRoundsPlugin — Gunner passive: +20% bullet damage per rank.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

export class SharpRoundsPlugin extends BaseSkillPlugin {
	/** @param {number} rank */
	getModifiers(rank) {
		return [
			{ stat: 'damage', op: 'add', value: this.skillConfig.effect.damageBonus * rank },
		];
	}

	/** @param {number} _rank */
	getVisualOverrides(_rank) {
		return {
			gunSkin: {
				barrelColor: '#ff4444',
				barrelGlow: '#ff4444',
			},
		};
	}
}
