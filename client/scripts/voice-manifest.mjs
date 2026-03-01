/**
 * @fileoverview Lore voice-over manifest for the intro cinematic.
 *
 * Each entry maps directly to a lore scene. The `text` field contains the
 * narration script (numbers spelled out for natural TTS reading), and `key`
 * determines the output filename.
 *
 * Used by `generate-voice.mjs` to produce audio files and imported by
 * `LoreIntro.js` at runtime to map scene → voice-over file.
 */

export const VOICE_MANIFEST = [
    {
        key: 'lore_voice_01_city',
        scene: 1,
        text: 'In twenty-one eighty-seven, humanity built Nexus Prime — a city of light, powered by the Neon Grid, an infinite energy lattice that connected every mind, every machine.',
    },
    {
        key: 'lore_voice_02_breach',
        scene: 2,
        text: 'Then the Grid tore open. From the breach came The Swarm — entities of pure entropy, drawn to the Grid\'s light like moths to a flame. They consumed everything they touched.',
    },
    {
        key: 'lore_voice_03_fall',
        scene: 3,
        text: 'In seventy-two hours, the outer districts fell. The military was overwhelmed. The Swarm adapted to every weapon, every strategy. Humanity was losing.',
    },
    {
        key: 'lore_voice_04_project',
        scene: 4,
        text: 'Deep beneath the city, Project Siege had been waiting. A fusion of human will and Grid energy — a living weapon designed to channel the very power the Swarm craved.',
    },
    {
        key: 'lore_voice_05_awakening',
        scene: 5,
        text: 'You are the Siege Protocol. The last line of defense. The Grid flows through you — every shot, every shield, every spark of power drawn from the same energy they seek to devour.',
    },
    {
        key: 'lore_voice_06_mission',
        scene: 6,
        text: 'They will come in waves. They will adapt. They will send their strongest. But with each wave you survive, you grow stronger. The Grid remembers. The Grid evolves.',
    },
    {
        key: 'lore_voice_07_stand',
        scene: 7,
        text: 'Hold the line. Thirty waves. Six siege commanders. One chance. The city\'s last light… is you.',
    },
];
