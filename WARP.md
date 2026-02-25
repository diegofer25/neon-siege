# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Repository: Neon Siege (vanilla JS + HTML5 Canvas)

Development commands (npm)
- Setup: npm install
- Dev server (primary): npm run dev
  - Serves on http://localhost:8080 via Vite (see vite.config.js)
- Dev server (alt): npm start
- Build: npm run build
- Preview: npm run preview
- Lint: npm run lint
- Lint (auto-fix): npm run lint:fix
- Note: Opening index.html directly may fail due to ES modules/CORS; use the dev server.

Environment and tooling
- Node.js >= 22 (enforced by package.json engines)
- ESLint configured via eslint.config.mjs (uses @eslint/js and globals for browser env)
- No test framework configured
- No CI/CD workflows present

High-level architecture and where to make changes
- Entry points and shell
  - index.html: Canvas and UI container elements; links CSS and JS.
  - style/: CSS split into base, layout, components, effects, responsive; index.css aggregates.
- Game orchestration
  - js/Game.js: Main controller. Owns the game loop, coordinates systems, updates entities, and handles state transitions (run/pause, waves, level-up/archetype/ascension).
  - js/managers/PerformanceManager.js: Optional real-time stats overlay. Enable by appending ?stats=true to the URL.
  - js/managers/SkillManager.js: XP, levels, attributes, and skill loadout progression.
- Core systems (systems/)
  - CollisionSystem.js: Circular collision detection and resolution between projectiles, player, enemies, and effects. Touchpoint for hit logic.
  - WaveManager.js: Enemy wave lifecycle — spawning, scaling, boss waves. Governs pacing and difficulty per wave.
  - EffectsManager.js: Visual effects pipeline (screen shake, flashes, particles hook-up) that responds to gameplay events.
  - EntityManager.js: Central registry and lifecycle manager for all entities (spawn, update, pool/recycle, cull).
  - AscensionSystem.js: Wave milestone ascension option generation and applied run modifiers.
- Entities and gameplay primitives
  - Player.js: Player state and auto-targeting/turn-speed mechanics; receives skill-derived stats/effects.
  - Enemy.js: Base enemy behaviors and variants; integrates with WaveManager for scaling.
  - Projectile.js: Bullet physics, damage, pierce/explode variants.
  - Particle.js: VFX particles pooled for performance.
- Utilities and configuration
  - utils/ObjectPool.js: Object pooling to minimize allocations for particles/projectiles.
  - utils/MathUtils.js: Math helpers used across systems.
  - config/GameConfig.js: Central gameplay balance — wave scaling, VFX caps, meta progression. Edit here for tuning.
  - config/SkillConfig.js: Skill tree/archetype config, tier gates, ascension pool, and progression constants.

Common modification guide
- Add or modify skills/archetypes: Update js/config/SkillConfig.js and ensure runtime effects are synced in js/Game.js (`_syncPlayerFromSkills`).
- Adjust difficulty scaling: Tweak WAVE.* and SCALING_FACTORS in js/config/GameConfig.js.
- Add enemy behaviors or types: Extend logic in js/Enemy.js and integrate spawn rules in systems/WaveManager.js.
- Change VFX intensity/performance caps: Update VFX limits in js/config/GameConfig.js and corresponding logic in systems/EffectsManager.js.
- Performance debugging: Launch dev server and navigate to http://localhost:8080/?stats=true to view FPS and frame timing.

Notes
- This is a static browser game served by Vite in development. Keep file paths and script tags consistent with index.html.

