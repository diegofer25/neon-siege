/**
 * @fileoverview Skill Plugin Registry — central import point for all skill plugins.
 *
 * Maps skill/ascension IDs → plugin classes. The SkillEffectEngine consumes this
 * on initialization to register all available plugins.
 *
 * To add a new skill plugin:
 *  1. Create the plugin class extending BaseSkillPlugin in the appropriate folder
 *  2. Import it here
 *  3. Add the mapping: skillId → PluginClass
 *
 * Skills without a registry entry will fall through to legacy code paths,
 * enabling incremental migration.
 */

// ── Gunner plugins ──
import { RapidFirePlugin } from './gunner/RapidFirePlugin.js';

// ── Technomancer plugins ──
import { VolatileKillsPlugin } from './technomancer/VolatileKillsPlugin.js';
import { EmpPulsePlugin } from './technomancer/EmpPulsePlugin.js';

// ── Ascension plugins ──
import { LifeStealPlugin } from './ascension/LifeStealPlugin.js';

/**
 * @type {Map<string, typeof import('./BaseSkillPlugin.js').BaseSkillPlugin>}
 */
export const SKILL_PLUGIN_REGISTRY = new Map([
	// Gunner
	['gunner_rapid_fire', RapidFirePlugin],

	// Technomancer
	['techno_volatile_kills', VolatileKillsPlugin],
	['techno_emp_pulse', EmpPulsePlugin],

	// Ascension modifiers
	['asc_vampiric', LifeStealPlugin],
]);
