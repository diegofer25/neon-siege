/**
 * @fileoverview Generate lore voice-over narration via ElevenLabs Text-to-Speech.
 *
 * Uses the TTS API (POST /v1/text-to-speech/{voice_id}) to convert each
 * manifest entry into an MP3 narration file stored in assets/audio/voice/.
 *
 * Usage:
 *   npm run voice:generate                          # Generate all lore voice lines
 *   npm run voice:generate -- --manifest=game       # Generate game callout voice lines
 *   npm run voice:generate -- --dry-run             # Preview only
 *   npm run voice:generate -- --only=lore_voice_01_city,lore_voice_07_stand
 *   npm run voice:generate -- --force               # Regenerate existing files
 *   npm run voice:generate -- --voice=EXAVITQu4vr4xnSDxMaL  # Use a different voice
 *
 * Environment:
 *   ELEVENLABS_API_KEY   Required (unless --dry-run)
 */

import { mkdir, access, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { VOICE_MANIFEST } from './voice-manifest.mjs';
import { GAME_VOICE_MANIFEST } from './game-voice-manifest.mjs';

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS = {
    outDir: 'assets/audio/voice',
    voiceId: 'JBFqnCBsd6RMkjVDRZzb',           // George — warm, authoritative British male
    modelId: 'eleven_multilingual_v2',
    outputFormat: 'mp3_44100_128',
    concurrency: 1,
    retries: 3,
    stability: 0.60,
    similarityBoost: 0.80,
    style: 0.35,
    useSpeakerBoost: true,
};

// ── CLI arg parsing ──────────────────────────────────────────────────────────

function parseArgs(argv) {
    const args = {
        dryRun: false,
        force: false,
        only: null,
        limit: null,
        manifest: 'lore',
        concurrency: DEFAULTS.concurrency,
        outDir: DEFAULTS.outDir,
        voiceId: DEFAULTS.voiceId,
        modelId: DEFAULTS.modelId,
        outputFormat: DEFAULTS.outputFormat,
        retries: DEFAULTS.retries,
        stability: DEFAULTS.stability,
        similarityBoost: DEFAULTS.similarityBoost,
        style: DEFAULTS.style,
        useSpeakerBoost: DEFAULTS.useSpeakerBoost,
    };

    for (const token of argv) {
        if (token === '--dry-run') args.dryRun = true;
        else if (token === '--force') args.force = true;
        else if (token === '--no-speaker-boost') args.useSpeakerBoost = false;
        else if (token.startsWith('--manifest=')) args.manifest = token.split('=')[1];
        else if (token.startsWith('--only=')) args.only = new Set(token.split('=')[1].split(',').map(v => v.trim()).filter(Boolean));
        else if (token.startsWith('--limit=')) args.limit = Number.parseInt(token.split('=')[1], 10);
        else if (token.startsWith('--concurrency=')) args.concurrency = Number.parseInt(token.split('=')[1], 10);
        else if (token.startsWith('--out-dir=')) args.outDir = token.split('=')[1];
        else if (token.startsWith('--voice=')) args.voiceId = token.split('=')[1];
        else if (token.startsWith('--model=')) args.modelId = token.split('=')[1];
        else if (token.startsWith('--output-format=')) args.outputFormat = token.split('=')[1];
        else if (token.startsWith('--retries=')) args.retries = Number.parseInt(token.split('=')[1], 10);
        else if (token.startsWith('--stability=')) args.stability = Number.parseFloat(token.split('=')[1]);
        else if (token.startsWith('--similarity-boost=')) args.similarityBoost = Number.parseFloat(token.split('=')[1]);
        else if (token.startsWith('--style=')) args.style = Number.parseFloat(token.split('=')[1]);
        else if (token === '--help' || token === '-h') {
            printHelp();
            process.exit(0);
        }
    }

    if (!Number.isFinite(args.concurrency) || args.concurrency < 1) throw new Error('Invalid --concurrency value.');
    if (args.limit !== null && (!Number.isFinite(args.limit) || args.limit < 1)) throw new Error('Invalid --limit value.');
    if (!Number.isFinite(args.retries) || args.retries < 0) throw new Error('Invalid --retries value.');

    return args;
}

function printHelp() {
    console.log(`
Generate Neon Siege lore voice-over via ElevenLabs Text-to-Speech

Usage:
  npm run voice:generate -- [options]

Options:
  --manifest=lore|game      Voice manifest to use (default: lore)
  --dry-run                 Show planned files without API calls
  --force                   Regenerate even when file exists
  --only=key1,key2          Generate specific manifest keys
  --limit=N                 Process only first N entries
  --concurrency=N           Parallel requests (default: ${DEFAULTS.concurrency})
  --out-dir=PATH            Output directory (default: ${DEFAULTS.outDir})
  --voice=VOICE_ID          ElevenLabs voice ID (default: ${DEFAULTS.voiceId} / George)
  --model=MODEL_ID          TTS model (default: ${DEFAULTS.modelId})
  --output-format=FMT       Audio format (default: ${DEFAULTS.outputFormat})
  --retries=N               Retries per request (default: ${DEFAULTS.retries})
  --stability=N             Voice stability 0-1 (default: ${DEFAULTS.stability})
  --similarity-boost=N      Similarity boost 0-1 (default: ${DEFAULTS.similarityBoost})
  --style=N                 Style exaggeration 0-1 (default: ${DEFAULTS.style})
  --no-speaker-boost        Disable speaker boost

Environment:
  ELEVENLABS_API_KEY        Required unless using --dry-run
`);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extensionFromOutputFormat(outputFormat) {
    if (outputFormat.startsWith('mp3_')) return 'mp3';
    if (outputFormat.startsWith('pcm_')) return 'wav';
    if (outputFormat.startsWith('ulaw_')) return 'wav';
    if (outputFormat.startsWith('alaw_')) return 'wav';
    return 'bin';
}

async function exists(filePath) {
    try { await access(filePath); return true; } catch { return false; }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ── ElevenLabs TTS request ───────────────────────────────────────────────────

async function requestTTS({ apiKey, text, voiceId, modelId, outputFormat, stability, similarityBoost, style, useSpeakerBoost, retries }) {
    const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`;
    let attempt = 0;
    let lastError = null;

    while (attempt <= retries) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text,
                    model_id: modelId,
                    voice_settings: {
                        stability,
                        similarity_boost: similarityBoost,
                        style,
                        use_speaker_boost: useSpeakerBoost,
                    },
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                const retriable = response.status === 429 || response.status >= 500;
                if (!retriable || attempt === retries) {
                    throw new Error(`ElevenLabs ${response.status}: ${errorText.slice(0, 400)}`);
                }
                const backoffMs = 800 * (2 ** attempt);
                await sleep(backoffMs);
                attempt += 1;
                continue;
            }

            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (error) {
            lastError = error;
            if (attempt === retries) break;
            const backoffMs = 800 * (2 ** attempt);
            await sleep(backoffMs);
            attempt += 1;
        }
    }

    throw lastError ?? new Error('Unknown ElevenLabs TTS request error.');
}

// ── Task queue ───────────────────────────────────────────────────────────────

function makeTaskQueue(manifest, extension, outDir) {
    return manifest.map(entry => ({
        key: entry.key,
        scene: entry.scene,
        text: entry.text,
        voiceId: entry.voiceId || null,
        filePath: path.join(outDir, `${entry.key}.${extension}`),
    }));
}

async function runPool(tasks, limit, worker) {
    const queue = [...tasks];
    const workers = Array.from({ length: limit }, async () => {
        while (queue.length > 0) {
            const task = queue.shift();
            if (!task) return;
            await worker(task);
        }
    });
    await Promise.all(workers);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const extension = extensionFromOutputFormat(args.outputFormat);

    const MANIFESTS = { lore: VOICE_MANIFEST, game: GAME_VOICE_MANIFEST };
    let manifest = MANIFESTS[args.manifest];
    if (!manifest) {
        throw new Error(`Unknown manifest "${args.manifest}". Use: ${Object.keys(MANIFESTS).join(', ')}`);
    }
    if (args.only) manifest = manifest.filter(item => args.only.has(item.key));
    if (args.limit !== null) manifest = manifest.slice(0, args.limit);

    if (manifest.length === 0) {
        throw new Error('No manifest entries selected. Check --only/--limit filters.');
    }

    const outDirAbsolute = path.resolve(process.cwd(), args.outDir);
    await mkdir(outDirAbsolute, { recursive: true });

    const tasks = makeTaskQueue(manifest, extension, outDirAbsolute);
    const summary = { total: tasks.length, generated: 0, skipped: 0, failed: 0, failures: [] };

    console.log(`Voice ID: ${args.voiceId}`);
    console.log(`Model: ${args.modelId}`);
    console.log(`Selected lines: ${manifest.length}`);
    console.log(`Planned files: ${tasks.length}`);
    console.log(`Output dir: ${outDirAbsolute}`);

    if (args.dryRun) {
        for (const task of tasks) {
            console.log(`[DRY] Scene ${task.scene}: ${path.relative(process.cwd(), task.filePath)}`);
            console.log(`      "${task.text}"`);
        }
        return;
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
        throw new Error('ELEVENLABS_API_KEY is required. Export it before running generation.');
    }

    await runPool(tasks, args.concurrency, async (task) => {
        const relativePath = path.relative(process.cwd(), task.filePath);
        const alreadyExists = await exists(task.filePath);
        if (alreadyExists && !args.force) {
            summary.skipped += 1;
            console.log(`[SKIP] ${relativePath}`);
            return;
        }

        try {
            const buffer = await requestTTS({
                apiKey,
                text: task.text,
                voiceId: task.voiceId || args.voiceId,
                modelId: args.modelId,
                outputFormat: args.outputFormat,
                stability: args.stability,
                similarityBoost: args.similarityBoost,
                style: args.style,
                useSpeakerBoost: args.useSpeakerBoost,
                retries: args.retries,
            });

            await writeFile(task.filePath, buffer);
            summary.generated += 1;
            console.log(`[OK]   ${relativePath}`);
        } catch (error) {
            summary.failed += 1;
            const message = error instanceof Error ? error.message : String(error);
            summary.failures.push({ filePath: relativePath, message });
            console.error(`[FAIL] ${relativePath} :: ${message}`);
        }
    });

    console.log('');
    console.log(`Generation complete: ${summary.generated} generated, ${summary.skipped} skipped, ${summary.failed} failed, ${summary.total} total.`);
    if (summary.failed > 0) {
        process.exitCode = 1;
        console.log('Failed items:');
        for (const failure of summary.failures) {
            console.log(`- ${failure.filePath}`);
        }
    }
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
});
