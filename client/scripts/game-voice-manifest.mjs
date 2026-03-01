/**
 * @fileoverview Game voice-over manifest for in-game narration callouts.
 *
 * Two voice personalities are used:
 *   • `narrator` — George (JBFqnCBsd6RMkjVDRZzb): warm, epic narrator for
 *     story-beat moments (game over, victory, ascension).
 *   • `ai`       — Rachel (21m00Tcm4TlvDq8ikWAM): clinical, precise AI system
 *     voice for gameplay callouts (boss intros, modifiers, combos).
 *
 * Each entry has an optional `voiceId` field. When present, the generation
 * script will use it instead of the CLI default voice.
 *
 * Used by `generate-voice.mjs` (via --manifest=game) and loaded at runtime
 * by `VoiceManager.js`.
 */

// ── Voice IDs ────────────────────────────────────────────────────────────────

const VOICE_NARRATOR = 'JBFqnCBsd6RMkjVDRZzb'; // George — warm, authoritative
const VOICE_AI       = '21m00Tcm4TlvDq8ikWAM';  // Rachel — clear, professional

// ── Manifest ─────────────────────────────────────────────────────────────────

export const GAME_VOICE_MANIFEST = [

    // ── Boss Introductions (AI voice) ────────────────────────────────────
    {
        key: 'boss_intro_classic',
        voiceId: VOICE_AI,
        text: 'Warning. Siege Commander detected. Brace for impact.',
    },
    {
        key: 'boss_intro_shield',
        voiceId: VOICE_AI,
        text: 'Alert. Shield Commander online. Standard weapons ineffective. Find the opening.',
    },
    {
        key: 'boss_intro_teleporter',
        voiceId: VOICE_AI,
        text: 'Caution. Phase Shifter detected. Tracking systems unreliable.',
    },
    {
        key: 'boss_intro_splitter',
        voiceId: VOICE_AI,
        text: 'Warning. Splitter entity approaching. Prepare for fragmentation.',
    },
    {
        key: 'boss_intro_vortex',
        voiceId: VOICE_AI,
        text: 'Critical alert. Vortex anomaly detected. Gravitational disruption imminent.',
    },
    {
        key: 'boss_intro_chrono',
        voiceId: VOICE_AI,
        text: 'Maximum threat. Chrono Commander detected. Time distortions active. Stay focused.',
    },

    // ── Game Over (Narrator voice) ───────────────────────────────────────
    {
        key: 'game_over_defeat',
        voiceId: VOICE_NARRATOR,
        text: 'Grid defenses have fallen. The Siege claims another soul.',
    },
    {
        key: 'game_over_close',
        voiceId: VOICE_NARRATOR,
        text: 'So close. The Grid remembers your sacrifice. Rise again.',
    },
    {
        key: 'game_over_record',
        voiceId: VOICE_NARRATOR,
        text: 'A new record, etched into the Grid\'s memory. Rise again, stronger.',
    },

    // ── Victory (Narrator voice) ─────────────────────────────────────────
    {
        key: 'victory_wave30',
        voiceId: VOICE_NARRATOR,
        text: 'The Siege is broken. The Grid stands. You are its champion.',
    },

    // ── Ascension (Narrator voice) ───────────────────────────────────────
    {
        key: 'ascension_offer',
        voiceId: VOICE_NARRATOR,
        text: 'The Grid offers forbidden power. Choose your evolution.',
    },

    // ── Wave Modifiers (AI voice) ────────────────────────────────────────
    {
        key: 'modifier_ion_storm',
        voiceId: VOICE_AI,
        text: 'Ion Storm detected. Enemy projectiles accelerating. Regen systems compromised.',
    },
    {
        key: 'modifier_overclock',
        voiceId: VOICE_AI,
        text: 'Overclock surge active. Enemy speed increasing. Exploit their vulnerability.',
    },
    {
        key: 'modifier_neon_fog',
        voiceId: VOICE_AI,
        text: 'Neon Fog rolling in. Visibility compromised. Adjust targeting.',
    },

    // ── Major Milestones (Narrator voice) ────────────────────────────────
    {
        key: 'milestone_wave10',
        voiceId: VOICE_NARRATOR,
        text: 'First Siege Commander down. Well done. But more are coming.',
    },
    {
        key: 'milestone_wave25',
        voiceId: VOICE_NARRATOR,
        text: 'Twenty five waves cleared. You are exceeding all projections.',
    },
    {
        key: 'milestone_wave50',
        voiceId: VOICE_NARRATOR,
        text: 'Fifty waves. Legendary status achieved. The Grid hails its champion.',
    },

    // ── Combo Tiers (AI voice) ───────────────────────────────────────────
    {
        key: 'combo_rampage',
        voiceId: VOICE_AI,
        text: 'Rampage!',
    },
    {
        key: 'combo_unstoppable',
        voiceId: VOICE_AI,
        text: 'Unstoppable!',
    },
    {
        key: 'combo_godmode',
        voiceId: VOICE_AI,
        text: 'God Mode activated!',
    },
];
