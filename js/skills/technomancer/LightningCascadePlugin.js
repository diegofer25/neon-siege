/**
 * @fileoverview LightningCascadePlugin — Technomancer ultimate: chain lightning.
 * Bounces between ALL enemies with escalating damage per bounce.
 */

import { BaseSkillPlugin } from '../BaseSkillPlugin.js';
import { playSFX } from '../../main.js';
import { vfxHelper } from '../../managers/VFXHelper.js';
const createFloatingText = vfxHelper.createFloatingText.bind(vfxHelper);
const screenFlash = vfxHelper.screenFlash.bind(vfxHelper);

export class LightningCascadePlugin extends BaseSkillPlugin {
	/**
	 * @param {import('../../Game.js').Game} game
	 * @param {{ skill: Object, rank: number }} skillInfo
	 * @returns {boolean}
	 */
	onCast(game, { skill }) {
		if (game.enemies.length === 0) return true;

		const effect = skill.effect;
		const maxBounces = effect.maxBounces;
		const amplification = effect.bounceAmplification;
		let damage = effect.baseDamage;
		const px = game.player.x;
		const py = game.player.y;

		// Sort enemies by distance from player, start with nearest
		const sorted = [...game.enemies].sort((a, b) => {
			const da = (a.x - px) ** 2 + (a.y - py) ** 2;
			const db = (b.x - px) ** 2 + (b.y - py) ** 2;
			return da - db;
		});

		const visited = new Set();
		let current = sorted[0];
		let bounceCount = 0;
		const chainPositions = [{ x: px, y: py }];

		while (current && bounceCount < maxBounces) {
			visited.add(current.id);
			chainPositions.push({ x: current.x, y: current.y });

			current.takeDamage(damage);
			bounceCount++;
			damage *= (1 + amplification);

			// Find nearest unvisited enemy
			let nearest = null;
			let nearestDist = Infinity;
			for (const enemy of game.enemies) {
				if (visited.has(enemy.id) || enemy.hp <= 0) continue;
				const dx = enemy.x - current.x;
				const dy = enemy.y - current.y;
				const dist = dx * dx + dy * dy;
				if (dist < nearestDist) {
					nearestDist = dist;
					nearest = enemy;
				}
			}
			current = nearest;
		}

		// Visual: lightning chain effect
		for (let i = 0; i < chainPositions.length - 1; i++) {
			game._createLightningEffect(chainPositions[i], chainPositions[i + 1]);
		}

		game.effectsManager.addScreenShake(12, 500);
		const { width, height } = game.getLogicalCanvasSize();
		createFloatingText(`LIGHTNING CASCADE! (${bounceCount} bounces)`, width / 2, height / 2 - 30, 'milestone-major');
		screenFlash();
		playSFX('boss_defeat');
		return true;
	}
}
