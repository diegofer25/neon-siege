import { GameConfig } from './config/GameConfig.js';

/**
 * PowerUp System
 *
 * Manages the power-up mechanics for the tower defense game.
 * Provides categorization of various player upgrades including offense, 
 * defense, and utility enhancements for the shop system.
 *
 * @fileoverview Core power-up system with shop integration and stack management
 */

/**
 * Represents a power-up that can be applied to enhance player capabilities
 *
 * @class PowerUp
 * @description Encapsulates power-up data and behavior, including application logic
 * and stacking rules for the shop-based purchase system.
 */
export class PowerUp {
	/**
	 * Available power-up types that can be stacked
	 * @static
	 * @readonly
	 * @type {string[]}
	 */
	static POWER_UP_STACK_NAMES = [
		"Damage Boost",
		"Fire Rate",
		"Speed Boost",
		"Turn Speed",
		"Piercing Shots",
		"Triple Shot",
		"Double Damage",
		"Rapid Fire",
		"Max Health",
		"Shield",
		"Regeneration",
		"Shield Regen",
		"Bigger Explosions",
		"Coin Magnet",
		"Lucky Shots",
		"Immolation Aura",
		"Shield Breaker",
		"Overcharge Burst",
		"Emergency Heal"
	];

	/**
	 * Complete collection of all available power-ups in the game
	 *
	 * @static
	 * @type {PowerUp[]}
	 * @description Power-ups are now purchased from the shop rather than randomly selected.
	 * All power-ups are available for purchase when requirements are met.
	 */
	static ALL_POWERUPS = [
		new PowerUp(
			"Damage Boost",
			"+25% bullet damage",
			"⚡",
			(player) => {
				player.applyMultiplicativeBoost('damageMod', 0.25, 'Damage Boost');
			}
		),

		new PowerUp(
			"Fire Rate",
			"+12.5% attack speed",
			"🔥",
			(player) => {
				player.applyMultiplicativeBoost('fireRateMod', 0.125, 'Fire Rate');
			}
		),

		new PowerUp(
			"Speed Boost",
			"+15% projectile speed",
			"💨",
			(player) => {
				player.applyMultiplicativeBoost('projectileSpeedMod', 0.15, 'Speed Boost');
			}
		),

		new PowerUp(
			"Turn Speed",
			"+10% rotation speed for faster targeting",
			"🌀",
			(player) => {
				player.applyMultiplicativeBoost('rotationSpeedMod', 0.10, 'Turn Speed');
			}
		),

	new PowerUp(
		"Piercing Shots",
		"Projectiles pierce +1 enemy. Damage reduced by 25% for each pierce.",
		"🎯",
		(player) => {
			player.piercingLevel = (player.piercingLevel || 0) + 1;
			player.powerUpStacks["Piercing Shots"]++;
		}
	),

		new PowerUp(
			"Triple Shot",
			"Fire 3 bullets in a spread. Extra shots start at 20% damage, +10% per stack.",
			"🔱",
			(player) => {
				player.hasTripleShot = true;
				if (Object.prototype.hasOwnProperty.call(player.powerUpStacks, "Triple Shot")) {
					player.powerUpStacks["Triple Shot"]++;
				} else {
					player.powerUpStacks["Triple Shot"] = 1;
				}
			}
		),

		new PowerUp(
			"Max Health",
			"+10% max health and heal to full",
			"💖",
			(player) => {
				const healthIncrease = Math.floor(player.maxHp * 0.1); // 10% increase
				player.maxHp += healthIncrease;
				player.hp = player.maxHp;
				player.powerUpStacks["Max Health"]++;
			}
		),

		new PowerUp(
			"Slow Field",
			"Enemies move slower near you (+10% slow, +20 radius) [Max 6 stacks]",
			"❄️",
			(player) => {
				if (player.slowFieldStrength < player.maxSlowFieldStacks) {
					player.hasSlowField = true;
					player.slowFieldStrength += 1; // Each stack increases strength
					player.slowFieldRadius += 20; // Each stack increases radius by 20
				}
			}
		),

		new PowerUp(
			"Shield",
			"Gain 50 shield points",
			"🛡️",
			(player) => {
				if (!player.hasShield) {
					player.hasShield = true;
					player.maxShieldHp = 50;
					player.shieldHp = 50;
				} else {
					player.maxShieldHp += 25;
					player.shieldHp += 25;
				}
				player.powerUpStacks["Shield"]++;
			}
		),

		new PowerUp(
			"Full Heal",
			"Restore all health",
			"✨",
			(player) => {
				player.hp = player.maxHp;
				if (player.hasShield) {
					player.shieldHp = player.maxShieldHp;
				}
			}
		),

		new PowerUp(
			"Life Steal",
			"Heal 1% of enemy max health on kill",
			"🧛",
			(player) => {
				player.hasLifeSteal = true;
			},
			false
		),

		new PowerUp(
			"Regeneration",
			"+1 health per second",
			"💚",
			(player) => {
				player.applyAdditiveBoost('hpRegen', 1, 'Regeneration');
			}
		),

		new PowerUp(
			"Shield Regen",
			"+2 shield per second",
			"🔋",
			(player) => {
				if (!player.hasShield) {
					player.hasShield = true;
					player.maxShieldHp = 25;
					player.shieldHp = 25;
				}
				player.applyAdditiveBoost('shieldRegen', 2, 'Shield Regen');
			}
		),

		new PowerUp(
			"Explosive Shots",
			"Bullets explode on impact",
			"💥",
			(player) => {
				player.explosiveShots = true;
			},
			false
		),

		new PowerUp(
			"Bigger Explosions",
			"+25% explosion radius and damage (enhances Explosive Shots)",
			"☄️",
			(player) => {
				player.explosionRadius *= 1.25;
				player.explosionDamage *= 1.25;
				player.powerUpStacks["Bigger Explosions"]++;
			}
		),

		new PowerUp(
			"Double Damage",
			"+50% bullet damage",
			"⚔️",
			(player) => {
				player.damageMod *= 1.5;
				player.powerUpStacks["Double Damage"]++;
			}
		),

		new PowerUp(
			"Rapid Fire",
			"+25% attack speed",
			"🌪️",
			(player) => {
				player.applyMultiplicativeBoost('fireRateMod', 0.25, 'Rapid Fire');
			}
		),

		new PowerUp(
			"Coin Magnet",
			"+20% coin rewards from enemy kills",
			"🧲",
			(player) => {
				if (!player.coinMagnetMultiplier) {
					player.coinMagnetMultiplier = 1;
				}
				player.applyAdditiveBoost('coinMagnetMultiplier', 0.2, 'Coin Magnet');
			}
		),

		new PowerUp(
			"Lucky Shots",
			"10% chance for bullets to deal double damage (stacks increase chance)",
			"🍀",
			(player) => {
				if (!player.luckyShots) {
					player.luckyShots = { chance: 0, active: true };
				}
				const stacks = player.powerUpStacks["Lucky Shots"] || 0;
				const diminishing = Math.pow(GameConfig.BALANCE.DIMINISHING_RETURN_BASE, stacks);
				player.luckyShots.chance = Math.min(0.6, player.luckyShots.chance + 0.02 * diminishing);
				player.powerUpStacks["Lucky Shots"] = stacks + 1;
			}
		),

	new PowerUp(
		"Immolation Aura",
		"All nearby enemies take 1% of their max health as burn damage per second",
		"🔥",
		(player) => {
			if (!player.immolationAura) {
				player.immolationAura = {
					active: true,
					damagePercent: 0.01, // 1% burn damage per second
					range: 100, // Aura radius
				};
			} else {
				player.immolationAura.damagePercent += 0.01; // Increase burn damage by 1% per stack
				player.immolationAura.range += 20; // Increase aura radius by 20
			}
			player.powerUpStacks["Immolation Aura"]++;
		}
	),

	// Shield Boss Counter Power-ups
	new PowerUp(
		"Shield Breaker",
		"Projectiles deal +100% damage to shields and prevent shield regeneration for 2s",
		"🔨",
		(player) => {
			player.hasShieldBreaker = true;
			if (!player.shieldBreakerStacks) {
				player.shieldBreakerStacks = 1;
				player.shieldBreakerDamage = 2.0; // 100% extra damage to shields
				player.shieldRegenDelay = 2000; // 2 second regen delay
			} else {
				player.shieldBreakerStacks++;
				player.shieldBreakerDamage += 0.5; // +50% more shield damage per stack
				player.shieldRegenDelay += 1000; // +1 second delay per stack
			}
			player.powerUpStacks["Shield Breaker"] = player.shieldBreakerStacks;
		},
		true
	),

	new PowerUp(
		"Adaptive Targeting",
		"Greatly increased rotation speed and targeting range. Projectiles track moving enemies.",
		"🎯",
		(player) => {
			player.hasAdaptiveTargeting = true;
			player.turnSpeed *= 2.0; // Double rotation speed
			player.targetingRange = 500; // Extended targeting range
			player.hasHomingShots = true; // Projectiles slightly home in on targets
			player.powerUpStacks["Adaptive Targeting"] = (player.powerUpStacks["Adaptive Targeting"] || 0) + 1;
		},
		false
	),

	new PowerUp(
		"Barrier Phase",
		"Become invulnerable for 3 seconds when health drops below 25%. 60s cooldown.",
		"✨",
		(player) => {
			player.hasBarrierPhase = true;
			player.barrierPhaseCooldown = 0;
			player.barrierPhaseMaxCooldown = 60000; // 60 seconds
			player.barrierPhaseDuration = 3000; // 3 seconds invulnerability
			player.barrierPhaseActive = false;
			player.barrierPhaseThreshold = 0.25; // Trigger at 25% health
		},
		false
	),

	new PowerUp(
		"Overcharge Burst",
		"Every 10th shot fires a powerful burst that pierces all shields and deals massive damage",
		"⚡",
		(player) => {
			if (!player.overchargeBurst) {
				player.overchargeBurst = {
					active: true,
					shotCounter: 0,
					burstInterval: 10,
					burstDamageMultiplier: 5.0,
					ignoresShields: true
				};
			} else {
				player.overchargeBurst.burstInterval = Math.max(5, player.overchargeBurst.burstInterval - 2);
				player.overchargeBurst.burstDamageMultiplier += 2.0;
			}
			player.powerUpStacks["Overcharge Burst"] = (player.powerUpStacks["Overcharge Burst"] || 0) + 1;
		},
		true
	),

	new PowerUp(
		"Emergency Heal",
		"Automatically heal to 50% when health drops below 10%. 45s cooldown.",
		"💉",
		(player) => {
			if (!player.emergencyHeal) {
				player.emergencyHeal = {
					active: true,
					cooldown: 0,
					maxCooldown: 45000, // 45 seconds
					healThreshold: 0.10, // Trigger at 10% health
					healTarget: 0.50 // Heal to 50%
				};
			} else {
				player.emergencyHeal.maxCooldown = Math.max(20000, player.emergencyHeal.maxCooldown - 10000);
				player.emergencyHeal.healTarget = Math.min(0.80, player.emergencyHeal.healTarget + 0.15);
			}
			player.powerUpStacks["Emergency Heal"] = (player.powerUpStacks["Emergency Heal"] || 0) + 1;
		},
		true
	)
	];

	/**
	 * Categorization of power-ups by their primary function
	 *
	 * @static
	 * @type {Object.<string, string[]>}
	 * @description Organizes power-ups into logical groups for filtering,
	 * UI organization, and potential future balancing features.
	 *
	 * Categories:
	 * - OFFENSE: Damage, firing rate, and projectile enhancements
	 * - DEFENSE: Health, shields, and survivability improvements
	 * - UTILITY: Special abilities and field effects
	 */
	static CATEGORIES = {
		OFFENSE: [
			"Damage Boost",
			"Fire Rate",
			"Piercing Shots",
			"Triple Shot",
			"Speed Boost",
			"Turn Speed",
			"Explosive Shots",
			"Bigger Explosions",
			"Double Damage",
			"Rapid Fire",
			"Shield Breaker",
			"Adaptive Targeting",
			"Overcharge Burst",
		],
		DEFENSE: [
			"Max Health",
			"Shield",
			"Regeneration",
			"Shield Regen",
			"Full Heal",
			"Barrier Phase",
			"Emergency Heal",
		],
		UTILITY: [
			"Life Steal",
			"Slow Field",
			"Coin Magnet",
			"Lucky Shots",
			"Immolation Aura"
		],
	};

	/**
	 * Retrieves power-ups belonging to a specific category
	 *
	 * @static
	 * @param {string} category - Category name (OFFENSE, DEFENSE, or UTILITY)
	 * @returns {PowerUp[]} Array of power-ups in the specified category
	 *
	 * @example
	 * const offensivePowerUps = PowerUp.getByCategory('OFFENSE');
	 * const defensivePowerUps = PowerUp.getByCategory('DEFENSE');
	 */
	static getByCategory = function (category) {
		const categoryNames = PowerUp.CATEGORIES[category] || [];
		return PowerUp.ALL_POWERUPS.filter((powerUp) =>
			categoryNames.includes(powerUp.name)
		);
	};

	/**
	 * Creates a new PowerUp instance
	 *
	 * @param {string} name - Display name of the power-up
	 * @param {string} description - Detailed description of the power-up's effects
	 * @param {string} icon - Emoji or symbol representing the power-up visually
	 * @param {Function} apply - Function that applies the power-up effect to a player
	 * @param {boolean} [stackable=true] - Whether multiple instances can be applied
	 *
	 * @example
	 * const damageBoost = new PowerUp(
	 *   "Damage Boost",
	 *   "+50% bullet damage",
	 *   "⚡",
	 *   (player) => { player.damageMod *= 1.5; },
	 *   true
	 * );
	 */
	constructor(name, description, icon, apply, stackable = true) {
		this.name = name;
		this.description = description;
		this.icon = icon;
		this.apply = apply;
		this.stackable = stackable;
	}
}
