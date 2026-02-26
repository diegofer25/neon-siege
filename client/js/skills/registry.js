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
 */

// ── Gunner plugins ──
import { SharpRoundsPlugin } from './gunner/SharpRoundsPlugin.js';
import { RapidFirePlugin } from './gunner/RapidFirePlugin.js';
import { FocusedFirePlugin } from './gunner/FocusedFirePlugin.js';
import { PiercingPlugin } from './gunner/PiercingPlugin.js';
import { TripleShotPlugin } from './gunner/TripleShotPlugin.js';
import { QuickAimPlugin } from './gunner/QuickAimPlugin.js';
import { CriticalMasteryPlugin } from './gunner/CriticalMasteryPlugin.js';
import { BarragePlugin } from './gunner/BarragePlugin.js';
import { OverchargePlugin } from './gunner/OverchargePlugin.js';
import { AimbotOverdrivePlugin } from './gunner/AimbotOverdrivePlugin.js';

// ── Technomancer plugins ──
import { ExplosiveRoundsPlugin } from './technomancer/ExplosiveRoundsPlugin.js';
import { BiggerBoomsPlugin } from './technomancer/BiggerBoomsPlugin.js';
import { EmpPulsePlugin } from './technomancer/EmpPulsePlugin.js';
import { ChainHitPlugin } from './technomancer/ChainHitPlugin.js';
import { VolatileKillsPlugin } from './technomancer/VolatileKillsPlugin.js';
import { BurnPlugin } from './technomancer/BurnPlugin.js';
import { ElementalSynergyPlugin } from './technomancer/ElementalSynergyPlugin.js';
import { NeonNovaPlugin } from './technomancer/NeonNovaPlugin.js';
import { MeltdownPlugin } from './technomancer/MeltdownPlugin.js';
import { LightningCascadePlugin } from './technomancer/LightningCascadePlugin.js';

// ── Ascension plugins ──
import { LifeStealPlugin } from './ascension/LifeStealPlugin.js';
import { GlassCannonPlugin } from './ascension/GlassCannonPlugin.js';
import { ThickSkinPlugin } from './ascension/ThickSkinPlugin.js';
import { XpSurgePlugin } from './ascension/XpSurgePlugin.js';
import { OverclockPlugin } from './ascension/OverclockPlugin.js';
import { ResiliencePlugin } from './ascension/ResiliencePlugin.js';
import { TreasureHunterPlugin } from './ascension/TreasureHunterPlugin.js';
import { BerserkerPlugin } from './ascension/BerserkerPlugin.js';
import { VolatileDeathPlugin } from './ascension/VolatileDeathPlugin.js';
import { ChainReactionPlugin } from './ascension/ChainReactionPlugin.js';
import { ShieldNovaPlugin } from './ascension/ShieldNovaPlugin.js';
import { EchoStrikePlugin } from './ascension/EchoStrikePlugin.js';
import { RicochetPlugin } from './ascension/RicochetPlugin.js';
import { BulletTimePlugin } from './ascension/BulletTimePlugin.js';

/**
 * @type {Map<string, typeof import('./BaseSkillPlugin.js').BaseSkillPlugin>}
 */
export const SKILL_PLUGIN_REGISTRY = new Map(/** @type {Array<[string, typeof import('./BaseSkillPlugin.js').BaseSkillPlugin]>} */ ([
	// ── Gunner ──
	['gunner_sharp_rounds', SharpRoundsPlugin],
	['gunner_rapid_fire', RapidFirePlugin],
	['gunner_focused_fire', FocusedFirePlugin],
	['gunner_piercing', PiercingPlugin],
	['gunner_triple_shot', TripleShotPlugin],
	['gunner_quick_aim', QuickAimPlugin],
	['gunner_critical_mastery', CriticalMasteryPlugin],
	['gunner_barrage', BarragePlugin],
	['gunner_overcharge', OverchargePlugin],
	['gunner_aimbot_overdrive', AimbotOverdrivePlugin],

	// ── Technomancer ──
	['techno_explosive_rounds', ExplosiveRoundsPlugin],
	['techno_bigger_booms', BiggerBoomsPlugin],
	['techno_emp_pulse', EmpPulsePlugin],
	['techno_chain_hit', ChainHitPlugin],
	['techno_volatile_kills', VolatileKillsPlugin],
	['techno_burn', BurnPlugin],
	['techno_elemental_synergy', ElementalSynergyPlugin],
	['techno_neon_nova', NeonNovaPlugin],
	['techno_meltdown', MeltdownPlugin],
	['techno_lightning_cascade', LightningCascadePlugin],

	// ── Ascension modifiers ──
	['asc_vampiric', LifeStealPlugin],
	['asc_glass_cannon', GlassCannonPlugin],
	['asc_thick_skin', ThickSkinPlugin],
	['asc_xp_surge', XpSurgePlugin],
	['asc_double_cd', OverclockPlugin],
	['asc_resilience', ResiliencePlugin],
	['asc_treasure_hunter', TreasureHunterPlugin],
	['asc_berserker', BerserkerPlugin],
	['asc_death_explosions', VolatileDeathPlugin],
	['asc_chain_reaction', ChainReactionPlugin],
	['asc_shield_nova', ShieldNovaPlugin],
	['asc_echo', EchoStrikePlugin],
	['asc_ricochet', RicochetPlugin],
	['asc_bullet_time', BulletTimePlugin],
]));
