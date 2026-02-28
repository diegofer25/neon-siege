/**
 * @fileoverview DevPanel — lightweight developer panel for runtime testing.
 *
 * Activated via `?dev=true` URL param. Toggle visibility with the backtick (`) key.
 * All controls operate directly on the live game instance — no store dispatching for
 * quick-and-dirty overrides, except where the existing pattern already uses store
 * (god mode, score).
 *
 * Following the same inline-style, self-contained pattern as StateDevTools.
 */

const PANEL_STYLES = `
#dev-panel {
	position: fixed;
	top: 8px;
	right: 8px;
	z-index: 10000;
	background: rgba(5, 5, 20, 0.92);
	color: #0ff;
	font: 11px/1.5 'Courier New', monospace;
	padding: 10px 14px;
	border: 1px solid #0ff;
	border-radius: 6px;
	max-height: 92vh;
	overflow-y: auto;
	min-width: 240px;
	display: none;
	box-shadow: 0 0 18px rgba(0, 255, 255, 0.25);
	user-select: none;
}
#dev-panel summary { cursor: pointer; color: #ff0; font-weight: bold; }
#dev-panel details { margin-bottom: 6px; }
#dev-panel hr { border-color: #333; margin: 6px 0; }
#dev-panel button {
	background: rgba(0, 255, 255, 0.12);
	color: #0ff;
	border: 1px solid #0ff;
	border-radius: 3px;
	padding: 3px 8px;
	margin: 2px;
	cursor: pointer;
	font: inherit;
}
#dev-panel button:hover { background: rgba(0, 255, 255, 0.3); }
#dev-panel button:active { background: rgba(0, 255, 255, 0.5); }
#dev-panel input[type="number"] {
	background: #111;
	color: #0ff;
	border: 1px solid #0ff;
	border-radius: 3px;
	padding: 2px 4px;
	width: 52px;
	font: inherit;
}
#dev-panel label { display: flex; align-items: center; gap: 4px; margin: 2px 0; }
#dev-panel .dp-section-title { color: #ff0; font-weight: bold; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin: 4px 0 2px; }
#dev-panel .dp-info { color: #888; font-size: 10px; line-height: 1.4; }
#dev-panel .dp-info span { color: #0ff; }
#dev-panel .dp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
#dev-panel .dp-header strong { color: #ff0; font-size: 13px; }
#dev-panel .dp-close { cursor: pointer; color: #f55; font-size: 16px; line-height: 1; }
#dev-panel .dp-close:hover { color: #f00; }
`;

export class DevPanel {
	/**
	 * @param {import('../Game.js').Game} game
	 */
	constructor(game) {
		this.game = game;
		const params = new URLSearchParams(window.location.search);
		this.enabled = params.get('dev') === 'true';
		this.visible = false;
		/** @type {HTMLElement|null} */
		this.el = null;
		/** @type {number|null} */
		this._infoInterval = null;

		if (this.enabled) {
			this._injectStyles();
			this._build();
			console.info('[DEV] Developer panel enabled (?dev=true). Press ; (semicolon) to toggle.');
		}
	}

	// ─── DOM Construction ────────────────────────────────────────────────────

	_injectStyles() {
		const style = document.createElement('style');
		style.textContent = PANEL_STYLES;
		document.head.appendChild(style);
	}

	_build() {
		const el = document.createElement('div');
		el.id = 'dev-panel';
		el.innerHTML = `
			<div class="dp-header">
				<strong>⚙ DEV PANEL</strong>
				<span class="dp-close" id="dp-close" title="Close">✕</span>
			</div>
			<hr>

			<!-- Wave Controls -->
			<details open>
				<summary>Waves</summary>
				<label>Wave #: <input id="dp-wave" type="number" min="1" value="1"></label>
				<button id="dp-jump-wave">Jump to Wave</button>
				<button id="dp-complete-wave">Complete Wave</button><br>
				<button id="dp-spawn-boss">Spawn Boss</button>
				<button id="dp-spawn-enemy">Spawn Enemy</button>
			</details>

			<!-- Player Controls -->
			<details open>
				<summary>Player</summary>
				<button id="dp-add-xp">+1 000 XP</button>
				<button id="dp-add-score">+5 000 Score</button><br>
				<button id="dp-full-heal">Full Heal</button>
				<button id="dp-kill-all">Kill All Enemies</button><br>
				<label><input id="dp-god-mode" type="checkbox"> God Mode</label>
			</details>

			<!-- Skill Controls -->
			<details>
				<summary>Skills</summary>
				<button id="dp-add-sp">+5 Skill Pts</button>
				<button id="dp-add-ap">+5 Attr Pts</button><br>
				<button id="dp-reset-skills">Reset Skills</button>
			</details>

			<!-- Ascension Controls -->
			<details>
				<summary>Ascension</summary>
				<button id="dp-trigger-ascension">Trigger Ascension</button>
				<button id="dp-reset-ascension">Reset Ascension</button>
			</details>

			<!-- Debug Toggles -->
			<details>
				<summary>Debug</summary>
				<label><input id="dp-hitboxes" type="checkbox"> Show Hitboxes</label>
				<label><input id="dp-trace" type="checkbox"> Trace Logging</label>
			</details>

			<hr>
			<!-- Live Info -->
			<div class="dp-section-title">Live Info</div>
			<div class="dp-info" id="dp-info">—</div>
		`;

		document.body.appendChild(el);
		this.el = el;
		this._bindControls();
	}

	// ─── Event Binding ───────────────────────────────────────────────────────

	_bindControls() {
		const g = this.game;

		// Close button
		document.getElementById('dp-close').addEventListener('click', () => this.toggle());

		// ── Wave Controls ────────────────────────────────────────────────
		document.getElementById('dp-jump-wave').addEventListener('click', () => {
			const n = parseInt(/** @type {HTMLInputElement} */ (document.getElementById('dp-wave')).value, 10);
			if (!n || n < 1) return;
			g.skipToWave(n);
		});

		document.getElementById('dp-complete-wave').addEventListener('click', () => {
			// Kill all remaining enemies to trigger wave completion
			const enemies = [...g.enemies];
			for (const enemy of enemies) {
				enemy.health = 0;
			}
		});

		document.getElementById('dp-spawn-boss').addEventListener('click', () => {
			g.waveManager.spawnBoss();
		});

		document.getElementById('dp-spawn-enemy').addEventListener('click', () => {
			g.waveManager.spawnEnemy();
		});

		// ── Player Controls ──────────────────────────────────────────────
		document.getElementById('dp-add-xp').addEventListener('click', () => {
			g.addXP(1000);
		});

		document.getElementById('dp-add-score').addEventListener('click', () => {
			g.score += 5000;
			g.dispatcher?.dispatch({ type: 'SCORE_ADD', payload: { amount: 5000 } });
		});

		document.getElementById('dp-full-heal').addEventListener('click', () => {
			if (g.player) {
				g.player.heal(g.player.maxHp);
				if (g.player.hasShield) {
					g.player.shieldHp = g.player.maxShieldHp;
				}
			}
		});

		document.getElementById('dp-kill-all').addEventListener('click', () => {
			for (const enemy of g.enemies) {
				enemy.health = 0;
			}
		});

		document.getElementById('dp-god-mode').addEventListener('change', (e) => {
			if (g.player) {
				g.player._godModeActive = /** @type {HTMLInputElement} */ (e.target).checked;
			}
		});

		// ── Skill Controls ───────────────────────────────────────────────
		document.getElementById('dp-add-sp').addEventListener('click', () => {
			g.skillManager.unspentSkillPoints += 5;
		});

		document.getElementById('dp-add-ap').addEventListener('click', () => {
			g.skillManager.unspentAttributePoints += 5;
		});

		document.getElementById('dp-reset-skills').addEventListener('click', () => {
			g.skillManager.reset();
			g._syncPlayerFromSkills();
		});

		// ── Ascension Controls ───────────────────────────────────────────
		document.getElementById('dp-trigger-ascension').addEventListener('click', () => {
			const options = g.ascensionSystem.generateOptions();
			if (options && options.length > 0) {
				g.ascensionSystem.pendingPick = true;
				g.ascensionSystem.currentOptions = options;
				g.gameState = 'ascension';
			}
		});

		document.getElementById('dp-reset-ascension').addEventListener('click', () => {
			g.ascensionSystem.reset();
			g._syncPlayerFromSkills();
		});

		// ── Debug Toggles ────────────────────────────────────────────────
		document.getElementById('dp-hitboxes').addEventListener('change', (e) => {
			g.debugHitboxes = /** @type {HTMLInputElement} */ (e.target).checked;
		});

		document.getElementById('dp-trace').addEventListener('change', (e) => {
			const checked = /** @type {HTMLInputElement} */ (e.target).checked;
			g.traceEnabled = checked;
			window.__NEON_TRACE_ENABLED__ = checked;
		});

		// Sync initial checkbox state
		/** @type {HTMLInputElement} */ (document.getElementById('dp-trace')).checked = !!g.traceEnabled;
	}

	// ─── Live Info ───────────────────────────────────────────────────────────

	_startInfoUpdate() {
		if (this._infoInterval) return;
		this._infoInterval = window.setInterval(() => this._updateInfo(), 500);
		this._updateInfo();
	}

	_stopInfoUpdate() {
		if (this._infoInterval) {
			clearInterval(this._infoInterval);
			this._infoInterval = null;
		}
	}

	_updateInfo() {
		const g = this.game;
		const infoEl = document.getElementById('dp-info');
		if (!infoEl) return;

		const p = g.player;
		const sm = g.skillManager;
		const fsmState = g.fsm?.current || '?';

		infoEl.innerHTML = [
			`State: <span>${fsmState}</span>`,
			`Wave: <span>${g.wave}</span> | Enemies: <span>${g.enemies.length}</span>`,
			`HP: <span>${p ? Math.round(p.hp) : '?'}/${p ? Math.round(p.maxHp) : '?'}</span>`
				+ (p?.hasShield ? ` | Shield: <span>${Math.round(p.shieldHp)}</span>` : ''),
			`Score: <span>${g.score}</span>`,
			`Lvl: <span>${sm.level}</span> | XP: <span>${sm.xp}/${sm.xpToNextLevel}</span>`,
			`SP: <span>${sm.unspentSkillPoints}</span> | AP: <span>${sm.unspentAttributePoints}</span>`,
			`Ascension: <span>${g.ascensionSystem.activeModifiers.length} mods</span>`,
			`Projectiles: <span>${g.projectiles.length}</span> | Particles: <span>${g.particles.length}</span>`,
			`God: <span>${p?._godModeActive ? 'ON' : 'off'}</span>`,
		].join('<br>');
	}

	// ─── Public API ──────────────────────────────────────────────────────────

	/** Toggle panel visibility */
	toggle() {
		if (!this.enabled || !this.el) return;
		this.visible = !this.visible;
		this.el.style.display = this.visible ? 'block' : 'none';

		if (this.visible) {
			this._startInfoUpdate();
		} else {
			this._stopInfoUpdate();
		}
	}

	/** Remove panel from DOM */
	destroy() {
		this._stopInfoUpdate();
		if (this.el) {
			this.el.remove();
			this.el = null;
		}
	}
}
