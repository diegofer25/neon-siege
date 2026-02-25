/**
 * @fileoverview NeonNovaPlugin — Technomancer active: massive AoE blast.
 * Deals 40% max HP to all enemies in range (+50px radius per rank).
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';
import { dealAreaDamage } from '../../utils/AOEUtils.js';
import { playSFX } from '../../main.js';
import { vfxHelper } from '../../managers/VFXHelper.js';
const createFloatingText = vfxHelper.createFloatingText.bind(vfxHelper);
const screenFlash = vfxHelper.screenFlash.bind(vfxHelper);

export class NeonNovaPlugin extends BaseSkillPlugin {
	/**
	 * @param {import('../../Game.js').Game} game
	 * @param {{ skill: Object, rank: number }} skillInfo
	 * @returns {boolean}
	 */
	onCast(game, { skill, rank }) {
		const effect = skill.effect;
		const radius = effect.radius + effect.radiusPerRank * (rank - 1);
		const px = game.player.x;
		const py = game.player.y;
		const hits = dealAreaDamage(game.enemies, px, py, radius, {
			calcDamage: (e) => e.maxHealth * effect.damagePercent,
		});
		const hitCount = hits.length;

		game.createExplosion(px, py, 60);
		game.createExplosionRing(px, py, radius);
		game.effectsManager.addScreenShake(10, 400);
		const { width, height } = game.getLogicalCanvasSize();
		createFloatingText(`NEON NOVA! (${hitCount} hit)`, width / 2, height / 2 - 30, 'level-up');
		screenFlash();
		playSFX('boss_defeat');
		return true;
	}
}
