/**
 * @fileoverview Asset preloader — fetches critical game assets during the
 * splash screen so they are warm in the browser cache once gameplay starts.
 *
 * Supports images, fonts, and generic fetch-based cache warming.
 * Reports progress via a callback so the UI can show real loading state.
 *
 * Usage:
 *   const preloader = new AssetPreloader(({ loaded, total, pct }) => { … });
 *   await preloader.run();
 */

// ── Asset manifests ─────────────────────────────────────────────────────────

/** @type {string[]} Critical images (start screen, lore, skill icons) */
const IMAGE_ASSETS = [
    'assets/images/start_screen_bg.jpg',
    'assets/images/start_screen_logo.png',
    // Lore backgrounds (first-run cinematic)
    'assets/images/lore/lore_01_city.jpg',
    'assets/images/lore/lore_02_breach.jpg',
    'assets/images/lore/lore_03_fall.jpg',
    'assets/images/lore/lore_04_project.jpg',
    'assets/images/lore/lore_05_awakening.jpg',
    'assets/images/lore/lore_06_mission.jpg',
    'assets/images/lore/lore_07_stand.jpg',
];

/** @type {string[]} Font files (woff2 — small, critical for rendering) */
const FONT_ASSETS = [
    'assets/fonts/audiowide-latin.woff2',
    'assets/fonts/audiowide-latin-ext.woff2',
    'assets/fonts/press-start-2p-latin.woff2',
    'assets/fonts/press-start-2p-latin-ext.woff2',
];

/**
 * @type {string[]}
 * Essential music tracks to cache-warm (menu + early gameplay).
 * We only fetch the bytes; no Audio element is created — AudioManager handles that.
 */
const AUDIO_ASSETS = [
    'assets/audio/music/music_menu_main.mp3',
    'assets/audio/music/music_run_wave_early.mp3',
    'assets/audio/music/music_lore_intro.mp3',
];

// ── Preloader ────────────────────────────────────────────────────────────────

/**
 * @typedef {{ loaded: number, total: number, pct: number, phase: string }} PreloadProgress
 */

export class AssetPreloader {
    /**
     * @param {(progress: PreloadProgress) => void} [onProgress] - Called on each asset completion
     */
    constructor(onProgress) {
        /** @private */
        this._onProgress = onProgress || (() => {});
        /** @private */
        this._loaded = 0;
        /** @private */
        this._total = IMAGE_ASSETS.length + FONT_ASSETS.length + AUDIO_ASSETS.length;
    }

    /**
     * Run all preloading tasks. Resolves when all assets are loaded or
     * have gracefully failed (we never block the splash on a network error).
     * @returns {Promise<void>}
     */
    async run() {
        this._loaded = 0;
        this._report('fonts');

        // Phase 1: fonts (tiny, fast — get text rendering correct ASAP)
        await this._loadBatch(FONT_ASSETS, 'fonts', (url) => this._warmFetch(url));

        // Phase 2: images (medium — fills the cache for start screen & lore)
        await this._loadBatch(IMAGE_ASSETS, 'images', (url) => this._warmImage(url));

        // Phase 3: audio (large — just cache the bytes, no playback)
        await this._loadBatch(AUDIO_ASSETS, 'audio', (url) => this._warmFetch(url));

        // Final: wait for the browser font API to confirm fonts are ready
        try { await document.fonts.ready; } catch { /* ignore */ }

        this._report('done');
    }

    /** The total number of assets being preloaded. */
    get total() { return this._total; }

    // ── Internals ────────────────────────────────────────────────────────

    /**
     * Process a batch of URLs concurrently with per-item progress.
     * @private
     * @param {string[]} urls
     * @param {string} phase
     * @param {(url: string) => Promise<void>} loader
     */
    async _loadBatch(urls, phase, loader) {
        const promises = urls.map(async (url) => {
            try {
                await loader(url);
            } catch {
                // Never block on a single failure — the game has graceful fallbacks
            }
            this._loaded += 1;
            this._report(phase);
        });
        await Promise.all(promises);
    }

    /**
     * Warm the browser cache via a plain fetch (good for audio, fonts, etc.).
     * Uses 'force-cache' so repeated visits skip the network entirely.
     * @private
     * @param {string} url
     */
    async _warmFetch(url) {
        const res = await fetch(url, { cache: 'force-cache', priority: 'low' });
        // Consume the body so the browser fully caches it
        if (res.body) {
            const reader = res.body.getReader();
            while (true) {
                const { done } = await reader.read();
                if (done) break;
            }
        }
    }

    /**
     * Preload an image via the Image constructor (ensures decode + raster cache).
     * @private
     * @param {string} url
     * @returns {Promise<void>}
     */
    _warmImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => reject(new Error(`Image failed: ${url}`));
            img.src = url;
        });
    }

    /**
     * Emit progress to the callback.
     * @private
     * @param {string} phase
     */
    _report(phase) {
        const pct = this._total > 0
            ? Math.min(100, Math.round((this._loaded / this._total) * 100))
            : 100;
        this._onProgress({ loaded: this._loaded, total: this._total, pct, phase });
    }
}
