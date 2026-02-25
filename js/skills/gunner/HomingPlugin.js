/**
 * @fileoverview HomingPlugin — Gunner passive: all projectiles gently track enemies.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';

export class HomingPlugin extends BaseSkillPlugin {
	getModifiers() {
		return [
			{ stat: 'homingStrength', op: 'set', value: this.skillConfig.effect.homingStrength },
		];
	}
}
