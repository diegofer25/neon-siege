import { mkdir, access, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { SOUND_EFFECT_MANIFEST, SOUND_STYLE_PREFIX } from './sfx-manifest.mjs';

const DEFAULTS = {
    outDir: 'assets/audio/sfx',
    variants: 2,
    concurrency: 2,
    modelId: 'eleven_text_to_sound_v2',
    outputFormat: 'mp3_44100_128',
    retries: 3
};

const STYLE_CONSTRAINTS = 'Avoid retro, 8-bit, chiptune, vintage arcade, and old-school synthwave aesthetics. Prioritize modern sound design and contemporary game-audio texture.';

function parseArgs(argv) {
    const args = {
        dryRun: false,
        force: false,
        only: null,
        limit: null,
        variants: DEFAULTS.variants,
        concurrency: DEFAULTS.concurrency,
        outDir: DEFAULTS.outDir,
        modelId: DEFAULTS.modelId,
        outputFormat: DEFAULTS.outputFormat,
        retries: DEFAULTS.retries,
        loop: false
    };

    for (const token of argv) {
        if (token === '--dry-run') args.dryRun = true;
        else if (token === '--force') args.force = true;
        else if (token === '--loop') args.loop = true;
        else if (token.startsWith('--only=')) args.only = new Set(token.split('=')[1].split(',').map(v => v.trim()).filter(Boolean));
        else if (token.startsWith('--limit=')) args.limit = Number.parseInt(token.split('=')[1], 10);
        else if (token.startsWith('--variants=')) args.variants = Number.parseInt(token.split('=')[1], 10);
        else if (token.startsWith('--concurrency=')) args.concurrency = Number.parseInt(token.split('=')[1], 10);
        else if (token.startsWith('--out-dir=')) args.outDir = token.split('=')[1];
        else if (token.startsWith('--model=')) args.modelId = token.split('=')[1];
        else if (token.startsWith('--output-format=')) args.outputFormat = token.split('=')[1];
        else if (token.startsWith('--retries=')) args.retries = Number.parseInt(token.split('=')[1], 10);
        else if (token === '--help' || token === '-h') {
            printHelp();
            process.exit(0);
        }
    }

    if (!Number.isFinite(args.variants) || args.variants < 1) throw new Error('Invalid --variants value. Use an integer >= 1.');
    if (!Number.isFinite(args.concurrency) || args.concurrency < 1) throw new Error('Invalid --concurrency value. Use an integer >= 1.');
    if (args.limit !== null && (!Number.isFinite(args.limit) || args.limit < 1)) throw new Error('Invalid --limit value. Use an integer >= 1.');
    if (!Number.isFinite(args.retries) || args.retries < 0) throw new Error('Invalid --retries value. Use an integer >= 0.');

    return args;
}

function printHelp() {
    console.log(`\nGenerate Neon Siege sound effects via ElevenLabs\n\nUsage:\n  npm run sfx:generate -- [options]\n\nOptions:\n  --dry-run                 Show planned files without API calls\n  --force                   Regenerate even when file exists\n  --only=key1,key2          Generate specific manifest keys\n  --limit=N                 Process only first N manifest entries\n  --variants=N              Variants per event (default: 2)\n  --concurrency=N           Parallel requests (default: 2)\n  --out-dir=PATH            Output directory (default: assets/audio/sfx)\n  --model=MODEL_ID          ElevenLabs model (default: eleven_text_to_sound_v2)\n  --output-format=FMT       API output format (default: mp3_44100_128)\n  --retries=N               Retries per request (default: 3)\n  --loop                    Generate loop-friendly sounds\n\nEnvironment:\n  ELEVENLABS_API_KEY        Required unless using --dry-run\n`);
}

function extensionFromOutputFormat(outputFormat) {
    if (outputFormat.startsWith('mp3_')) return 'mp3';
    if (outputFormat.startsWith('pcm_')) return 'wav';
    if (outputFormat.startsWith('ulaw_')) return 'wav';
    if (outputFormat.startsWith('alaw_')) return 'wav';
    return 'bin';
}

function buildPrompt(entry) {
    return `${SOUND_STYLE_PREFIX}${entry.text} ${STYLE_CONSTRAINTS}`;
}

async function exists(filePath) {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function requestSound({ apiKey, prompt, durationSeconds, promptInfluence, loop, modelId, outputFormat, retries }) {
    const endpoint = `https://api.elevenlabs.io/v1/sound-generation?output_format=${encodeURIComponent(outputFormat)}`;
    let attempt = 0;
    let lastError = null;

    while (attempt <= retries) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: prompt,
                    loop,
                    duration_seconds: durationSeconds,
                    prompt_influence: promptInfluence,
                    model_id: modelId
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                const retriable = response.status === 429 || response.status >= 500;
                if (!retriable || attempt === retries) {
                    throw new Error(`ElevenLabs ${response.status}: ${errorText.slice(0, 400)}`);
                }
                const backoffMs = 400 * (2 ** attempt);
                await sleep(backoffMs);
                attempt += 1;
                continue;
            }

            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (error) {
            lastError = error;
            if (attempt === retries) break;
            const backoffMs = 400 * (2 ** attempt);
            await sleep(backoffMs);
            attempt += 1;
        }
    }

    throw lastError ?? new Error('Unknown ElevenLabs request error.');
}

function makeTaskQueue(manifest, variants, extension, outDir) {
    const tasks = [];
    for (const entry of manifest) {
        for (let variant = 1; variant <= variants; variant += 1) {
            tasks.push({
                key: entry.key,
                category: entry.category,
                durationSeconds: entry.durationSeconds,
                promptInfluence: entry.promptInfluence,
                prompt: buildPrompt(entry),
                filePath: path.join(outDir, `${entry.key}_v${variant}.${extension}`)
            });
        }
    }
    return tasks;
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

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const extension = extensionFromOutputFormat(args.outputFormat);

    let manifest = SOUND_EFFECT_MANIFEST;
    if (args.only) manifest = manifest.filter(item => args.only.has(item.key));
    if (args.limit !== null) manifest = manifest.slice(0, args.limit);

    if (manifest.length === 0) {
        throw new Error('No manifest entries selected. Check --only/--limit filters.');
    }

    const outDirAbsolute = path.resolve(process.cwd(), args.outDir);
    await mkdir(outDirAbsolute, { recursive: true });

    const tasks = makeTaskQueue(manifest, args.variants, extension, outDirAbsolute);
    const summary = {
        total: tasks.length,
        generated: 0,
        skipped: 0,
        failed: 0,
        failures: []
    };

    console.log(`Selected events: ${manifest.length}`);
    console.log(`Planned files: ${tasks.length}`);
    console.log(`Output dir: ${outDirAbsolute}`);

    if (args.dryRun) {
        for (const task of tasks) {
            console.log(`[DRY] ${path.relative(process.cwd(), task.filePath)}`);
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
            const buffer = await requestSound({
                apiKey,
                prompt: task.prompt,
                durationSeconds: task.durationSeconds,
                promptInfluence: task.promptInfluence,
                loop: args.loop,
                modelId: args.modelId,
                outputFormat: args.outputFormat,
                retries: args.retries
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