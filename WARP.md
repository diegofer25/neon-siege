# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Repository: Neon Tower Defense Shooter (vanilla JS + HTML5 Canvas)

Development commands (npm)
- Setup: npm install
- Dev server (primary): npm run dev
  - Serves index.html on http://localhost:8080 via live-server with watch enabled for js, style.css, index.html
- Dev server (alt): npm start
- Lint: npm run lint
- Lint (auto-fix): npm run lint:fix
- No build step: The game runs directly in the browser. You can also open index.html directly, but the dev server is recommended.

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
  - js/Game.js: Main controller. Owns the game loop, coordinates systems, updates entities, and handles state transitions (run/pause, waves, shop).
  - js/managers/PerformanceManager.js: Optional real-time stats overlay. Enable by appending ?stats=true to the URL.
- Core systems (systems/)
  - CollisionSystem.js: Circular collision detection and resolution between projectiles, player, enemies, and effects. Touchpoint for hit logic.
  - WaveManager.js: Enemy wave lifecycle — spawning, scaling, boss waves. Governs pacing and difficulty per wave.
  - EffectsManager.js: Visual effects pipeline (screen shake, flashes, particles hook-up) that responds to gameplay events.
  - EntityManager.js: Central registry and lifecycle manager for all entities (spawn, update, pool/recycle, cull).
- Entities and gameplay primitives
  - Player.js: Player state and auto-targeting/turn-speed mechanics; applies power-up effects.
  - Enemy.js: Base enemy behaviors and variants; integrates with WaveManager for scaling.
  - Projectile.js: Bullet physics, damage, pierce/explode variants.
  - Particle.js: VFX particles pooled for performance.
  - PowerUp.js: Power-up catalog and application logic (stackable effects, pricing hooks).
  - Shop.js: Shop phase UI/flow; sources prices/categories and applies purchases.
- Utilities and configuration
  - utils/ObjectPool.js: Object pooling to minimize allocations for particles/projectiles.
  - utils/MathUtils.js: Math helpers used across systems.
  - config/GameConfig.js: Central gameplay balance — wave scaling, power-up prices, VFX caps. Edit here for tuning.

Common modification guide
- Add or modify power-ups: Define new PowerUp in js/PowerUp.js; add price in js/config/GameConfig.js; categorize via Shop or PowerUp catalog.
- Adjust difficulty scaling: Tweak WAVE.* and SCALING_FACTORS in js/config/GameConfig.js.
- Add enemy behaviors or types: Extend logic in js/Enemy.js and integrate spawn rules in systems/WaveManager.js.
- Change VFX intensity/performance caps: Update VFX limits in js/config/GameConfig.js and corresponding logic in systems/EffectsManager.js.
- Performance debugging: Launch dev server and navigate to http://localhost:8080/?stats=true to view FPS and frame timing.

Notes
- This is a static, no-bundler project. Live reloading is provided by live-server. Keep file paths and script tags consistent with index.html.

