/**
 * @fileoverview ExplosiveRoundsPlugin — Technomancer passive: bullets explode on impact.
 * Provides explosion-related modifiers and the explosiveShots flag via getPlayerConfig.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

export class ExplosiveRoundsPlugin extends BaseSkillPlugin {
	getModifiers() {
		const effect = this.skillConfig.effect;
		return [
			{ stat: 'explosionRadius', op: 'add', value: effect.explosionRadius },
			{ stat: 'explosionDamageRatio', op: 'add', value: effect.explosionDamageRatio },
		];
	}

	getPlayerConfig() {
		return { explosiveShots: true };
	}
}
