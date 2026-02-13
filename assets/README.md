# Neon Tower Defense Shooter - Assets

This folder stores game audio and visual assets.

## Sound Effects Generation

This project includes an offline generator for SFX using ElevenLabs.

- Script: `scripts/generate-sfx.mjs`
- Manifest: `scripts/sfx-manifest.mjs`
- Default output: `assets/audio/sfx/`
- Naming: `<event_key>_v<variant>.mp3`

### Generate Once (recommended)

```bash
export ELEVENLABS_API_KEY="<your-api-key>"
npm run sfx:generate
```

### Preview Planned Files (no API call)

```bash
npm run sfx:plan
```

### Useful Options

```bash
npm run sfx:generate -- --only=player_shoot_basic,enemy_death
npm run sfx:generate -- --force
npm run sfx:generate -- --variants=2 --concurrency=2
```

## Music Generation

This project includes an offline generator for music tracks using ElevenLabs Music.

- Script: `scripts/generate-music.mjs`
- Manifest: `scripts/music-manifest.mjs`
- Default output: `assets/audio/music/`
- Naming: `<track_key>.mp3`

### Generate Once (recommended)

```bash
export ELEVENLABS_API_KEY="<your-api-key>"
npm run music:generate
```

### Preview Planned Files (no API call)

```bash
npm run music:plan
```

### Useful Options

```bash
npm run music:generate -- --only=music_menu_main,music_run_wave_early
npm run music:generate -- --concurrency=1 --retries=4
npm run music:generate -- --force
```

## Implementation Note

The game remains playable without audio files. Generated assets are intended as an offline pipeline step, not runtime generation.
