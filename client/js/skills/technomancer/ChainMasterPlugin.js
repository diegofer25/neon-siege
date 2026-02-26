/**
 * @fileoverview ChainMasterPlugin — Technomancer passive: chain hits deal escalating damage.
 * Provides the chainDamageEscalation value via the modifier pipeline,
 * consumed by ChainHitPlugin when building its player config.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

export class ChainMasterPlugin extends BaseSkillPlugin {
	getModifiers() {
		return [
			{ stat: 'chainDamageEscalation', op: 'add', value: this.skillConfig.effect.chainDamageEscalation },
		];
	}
}
