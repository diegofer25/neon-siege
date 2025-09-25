# agents.md

Purpose
- Guidance for AI coding agents (Warp, Copilot, Cursor, Claude, etc.) working in this repository.
- Focus on environment, core commands, high-level architecture, and project-specific guardrails to avoid breaking the live, no-bundler setup.

Project overview
- Neon Tower Defense Shooter: browser-based, vanilla JavaScript + HTML5 Canvas.
- Static project: no bundler/build step; runs directly in the browser.

Environment
- Node.js >= 22 (enforced via package.json engines)
- npm as package manager (package-lock.json present)
- ESLint configured with @eslint/js via eslint.config.mjs (browser globals)
- No tests configured; no CI/CD workflows present

Commands
- Setup: npm install
- Dev server (primary): npm run dev (live-server on http://localhost:8080 with watch for js, style.css, index.html)
- Dev server (alt): npm start
- Lint: npm run lint
- Lint (auto-fix): npm run lint:fix
- No build step: You can also open index.html directly; dev server is preferred for live reload.

High-level architecture
- Entry/UI shell
  - index.html: hosts the canvas and UI; links styles and scripts.
  - style/: CSS split into base, layout, components, effects, responsive; index.css aggregates.
- Main orchestration
  - js/Game.js: central controller; owns the loop, coordinates systems, updates entities, manages state (run/pause, waves, shop).
  - js/managers/PerformanceManager.js: optional runtime stats; enable with ?stats=true.
- Core systems (js/systems/)
  - CollisionSystem.js: circular collisions and hit resolution among projectiles/player/enemies/effects.
  - WaveManager.js: enemy wave lifecycle (spawning, scaling, special waves/bosses).
  - EffectsManager.js: screen shake, flashes, particle hooks.
  - EntityManager.js: entity lifecycle (spawn, update, pooling/recycle, culling).
- Entities and gameplay primitives (js/)
  - Player.js, Enemy.js, Projectile.js, Particle.js, PowerUp.js, Shop.js
- Utilities & config
  - utils/ObjectPool.js: pooling for particles/projectiles.
  - utils/MathUtils.js: math helpers.
  - config/GameConfig.js: central gameplay balance (wave scaling, prices, VFX caps).

Common modifications (where to change things)
- Add/modify power-ups: define in js/PowerUp.js; add price in js/config/GameConfig.js; categorize in Shop/PowerUp catalog.
- Tune difficulty: adjust WAVE.* and SCALING_FACTORS in js/config/GameConfig.js.
- Add enemy types/behaviors: extend js/Enemy.js; integrate spawn/scaling in js/systems/WaveManager.js.
- VFX and performance caps: tweak limits in js/config/GameConfig.js and logic in js/systems/EffectsManager.js.
- Performance debugging: append ?stats=true to the game URL when running the dev server.

Project-specific guardrails for agents
- Do not introduce a bundler or build pipeline (keep the static, no-bundler architecture).
- Do not change the Node engine requirement; keep Node >= 22.
- Do not alter script/link paths or loading order in index.html unless explicitly requested; the live-server flow depends on current paths.
- Do not add a test framework or CI/CD workflows unless requested; explicitly document if you do.
- Prefer small, incremental changes within existing modules and patterns; reuse pooling and systems architecture.
- Keep CSS structure under style/ intact; index.css is the aggregator.
- If adding assets, place under assets/ (the game functions without audio; loading has graceful error handling).

Notes
- This repository is optimized for quick iteration with live-server and object pooling; favor changes that preserve 60fps responsiveness and minimal allocations.
- For large changes touching multiple systems, describe the plan in PR description and highlight any new config flags added to js/config/GameConfig.js.

