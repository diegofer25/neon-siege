/**
 * @fileoverview AdminPanel — password-protected cheat panel for testing/admin use.
 *
 * Activated with the `;` (Semicolon) key. Requires a password on first open per session.
 * Provides bulk skill unlocks, attribute maxing, resource grants, and god-mode toggles.
 *
 * Self-contained: injects its own styles into <head>.
 */

import { ARCHETYPES, PLAYABLE_ARCHETYPES, ATTRIBUTES, ASCENSION_POOL } from '../config/SkillConfig.js';

// ── Password ─────────────────────────────────────────────────────────────────
// Password: N30n$!ege#Adm1n_2026
const ADMIN_PASSWORD = 'N30n$!ege#Adm1n_2026';

const PANEL_STYLES = `
#admin-panel-overlay {
	position: fixed;
	inset: 0;
	z-index: 20000;
	background: rgba(0, 0, 0, 0.75);
	display: none;
	justify-content: center;
	align-items: center;
}
#admin-panel-overlay.visible {
	display: flex;
}
#admin-panel {
	position: relative;
	z-index: 20001;
	background: rgba(10, 0, 30, 0.96);
	color: #f0f0f0;
	font: 12px/1.6 'Courier New', monospace;
	padding: 18px 22px;
	border: 2px solid #f0f;
	border-radius: 10px;
	max-height: 85vh;
	overflow-y: auto;
	min-width: 340px;
	max-width: 440px;
	box-shadow: 0 0 40px rgba(255, 0, 255, 0.4), inset 0 0 20px rgba(255, 0, 255, 0.05);
	user-select: none;
}
#admin-panel::-webkit-scrollbar { width: 6px; }
#admin-panel::-webkit-scrollbar-thumb { background: #f0f; border-radius: 3px; }
#admin-panel .ap-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 8px;
}
#admin-panel .ap-header strong {
	color: #f0f;
	font-size: 14px;
	text-shadow: 0 0 8px #f0f;
}
#admin-panel .ap-close {
	cursor: pointer;
	color: #f55;
	font-size: 18px;
	line-height: 1;
	transition: color 0.15s;
}
#admin-panel .ap-close:hover { color: #f00; }
#admin-panel hr { border: none; border-top: 1px solid #333; margin: 8px 0; }
#admin-panel .ap-section {
	margin-bottom: 10px;
}
#admin-panel .ap-section-title {
	color: #f0f;
	font-weight: bold;
	font-size: 11px;
	text-transform: uppercase;
	letter-spacing: 1px;
	margin-bottom: 4px;
	text-shadow: 0 0 4px #f0f;
}
#admin-panel button {
	background: rgba(255, 0, 255, 0.1);
	color: #f0f;
	border: 1px solid #f0f;
	border-radius: 4px;
	padding: 5px 10px;
	margin: 3px;
	cursor: pointer;
	font: inherit;
	font-size: 11px;
	transition: background 0.15s, box-shadow 0.15s;
}
#admin-panel button:hover {
	background: rgba(255, 0, 255, 0.25);
	box-shadow: 0 0 8px rgba(255, 0, 255, 0.3);
}
#admin-panel button:active {
	background: rgba(255, 0, 255, 0.45);
}
#admin-panel button.ap-danger {
	border-color: #f44;
	color: #f44;
	background: rgba(255, 68, 68, 0.08);
}
#admin-panel button.ap-danger:hover {
	background: rgba(255, 68, 68, 0.2);
}
#admin-panel button.ap-success {
	border-color: #4f4;
	color: #4f4;
	background: rgba(68, 255, 68, 0.08);
}
#admin-panel button.ap-success:hover {
	background: rgba(68, 255, 68, 0.2);
}
#admin-panel .ap-status {
	color: #888;
	font-size: 10px;
	margin-top: 4px;
	min-height: 14px;
}
#admin-panel .ap-status.success { color: #4f4; }
#admin-panel .ap-status.error { color: #f44; }

/* Password prompt */
#admin-password-prompt {
	text-align: center;
}
#admin-password-prompt input {
	background: #111;
	color: #f0f;
	border: 1px solid #f0f;
	border-radius: 4px;
	padding: 6px 10px;
	font: inherit;
	width: 100%;
	margin: 8px 0;
	text-align: center;
}
#admin-password-prompt input::placeholder {
	color: #666;
}
#admin-password-prompt .ap-pw-error {
	color: #f44;
	font-size: 10px;
	min-height: 14px;
}
`;

export class AdminPanel {
	/**
	 * @param {import('../Game.js').Game} game
	 */
	constructor(game) {
		this.game = game;
		this.visible = false;
		this.authenticated = false;
		/** @type {HTMLElement|null} */
		this.overlayEl = null;
		/** @type {HTMLElement|null} */
		this.panelEl = null;
		/** @type {HTMLElement|null} */
		this._statusEl = null;

		this._injectStyles();
		this._build();
	}

	// ─── DOM Construction ────────────────────────────────────────────────────

	_injectStyles() {
		const style = document.createElement('style');
		style.textContent = PANEL_STYLES;
		document.head.appendChild(style);
	}

	_build() {
		const overlay = document.createElement('div');
		overlay.id = 'admin-panel-overlay';
		overlay.innerHTML = `
			<div id="admin-panel">
				<div class="ap-header">
					<strong>🔐 ADMIN PANEL</strong>
					<span class="ap-close" id="ap-close" title="Close (;)">✕</span>
				</div>
				<hr>
				<!-- Password screen -->
				<div id="admin-password-prompt">
					<div style="color:#f0f; margin-bottom:6px;">Enter Admin Password</div>
					<input type="password" id="ap-password-input" placeholder="Password..." autocomplete="off">
					<button id="ap-password-submit">Unlock</button>
					<div class="ap-pw-error" id="ap-pw-error"></div>
				</div>
				<!-- Main admin content (hidden until authenticated) -->
				<div id="admin-panel-content" style="display:none;">
					<!-- Archetype Skills -->
					<div class="ap-section">
						<div class="ap-section-title">⚔ Archetype Skills</div>
						<button id="ap-max-gunner" class="ap-success">Max All Gunner Skills</button>
						<button id="ap-max-techno" class="ap-success">Max All Technomancer Skills</button>
						<button id="ap-max-all-skills" class="ap-success">Max ALL Skills</button>
						<button id="ap-reset-skills" class="ap-danger">Reset All Skills</button>
					</div>

					<!-- Attributes -->
					<div class="ap-section">
						<div class="ap-section-title">💎 Attributes</div>
						<button id="ap-max-str">Max STR</button>
						<button id="ap-max-dex">Max DEX</button>
						<button id="ap-max-vit">Max VIT</button>
						<button id="ap-max-int">Max INT</button>
						<button id="ap-max-luck">Max LUCK</button><br>
						<button id="ap-max-all-attrs" class="ap-success">Max ALL Attributes</button>
						<button id="ap-reset-attrs" class="ap-danger">Reset Attributes</button>
					</div>

					<!-- Resources -->
					<div class="ap-section">
						<div class="ap-section-title">💰 Resources</div>
						<button id="ap-add-sp50">+50 Skill Points</button>
						<button id="ap-add-ap50">+50 Attribute Points</button>
						<button id="ap-add-xp10k">+10 000 XP</button>
						<button id="ap-add-score50k">+50 000 Score</button>
						<button id="ap-set-level20">Set Level 20</button>
					</div>

					<!-- Player -->
					<div class="ap-section">
						<div class="ap-section-title">🛡 Player</div>
						<button id="ap-full-heal" class="ap-success">Full Heal + Shield</button>
						<button id="ap-god-mode">Toggle God Mode</button>
						<button id="ap-kill-all" class="ap-danger">Kill All Enemies</button>
					</div>

					<!-- Wave -->
					<div class="ap-section">
						<div class="ap-section-title">🌊 Waves</div>
						<button id="ap-skip-wave">Skip to Next Wave</button>
						<button id="ap-jump-wave10">Jump to Wave 10</button>
						<button id="ap-jump-wave25">Jump to Wave 25</button>
						<button id="ap-jump-wave50">Jump to Wave 50</button>
					</div>

					<!-- Ascension -->
					<div class="ap-section">
						<div class="ap-section-title">🜂 Ascension</div>
						<button id="ap-asc-offer">Offer Ascension Now</button>
						<button id="ap-asc-random">Grant Random Ascension</button>
						<button id="ap-asc-all" class="ap-success">Grant ALL Ascensions</button>
					</div>

					<!-- Moderator Boost -->
					<div class="ap-section">
						<div class="ap-section-title">🧩 Moderator Tools</div>
						<button id="ap-mod-plus1000" class="ap-success">+1000 Everything</button>
					</div>

					<!-- Full Power -->
					<div class="ap-section">
						<div class="ap-section-title">⚡ Nuclear Options</div>
						<button id="ap-full-power" class="ap-success" style="font-size:12px; padding:8px 14px;">
							🚀 FULL POWER (Max Everything)
						</button>
					</div>

					<hr>
					<div class="ap-status" id="ap-status">Ready.</div>
				</div>
			</div>
		`;

		document.body.appendChild(overlay);
		this.overlayEl = overlay;
		this.panelEl = overlay.querySelector('#admin-panel');

		// Close on overlay click (outside panel)
		overlay.addEventListener('click', (e) => {
			if (e.target === overlay) this.hide();
		});

		this._bindControls();
	}

	// ─── Controls ────────────────────────────────────────────────────────────

	_bindControls() {
		const g = this.game;

		// Close button
		document.getElementById('ap-close').addEventListener('click', () => this.hide());

		// Password
		const pwInput = /** @type {HTMLInputElement} */ (document.getElementById('ap-password-input'));
		const pwSubmit = document.getElementById('ap-password-submit');
		const pwError = document.getElementById('ap-pw-error');

		const attemptLogin = () => {
			if (pwInput.value === ADMIN_PASSWORD) {
				this.authenticated = true;
				document.getElementById('admin-password-prompt').style.display = 'none';
				document.getElementById('admin-panel-content').style.display = 'block';
				pwInput.value = '';
				pwError.textContent = '';
			} else {
				pwError.textContent = 'Incorrect password.';
				pwInput.value = '';
				pwInput.focus();
			}
		};

		pwSubmit.addEventListener('click', attemptLogin);
		pwInput.addEventListener('keydown', (e) => {
			if (e.code === 'Enter') attemptLogin();
			e.stopPropagation(); // prevent game input while typing
		});
		pwInput.addEventListener('keyup', (e) => e.stopPropagation());
		pwInput.addEventListener('keypress', (e) => e.stopPropagation());

		// ── Archetype Skills ─────────────────────────────────────────────
		document.getElementById('ap-max-gunner').addEventListener('click', () => {
			this._maxArchetypeSkills('GUNNER');
			this._status('All Gunner skills maxed!', 'success');
		});

		document.getElementById('ap-max-techno').addEventListener('click', () => {
			this._maxArchetypeSkills('TECHNOMANCER');
			this._status('All Technomancer skills maxed!', 'success');
		});

		document.getElementById('ap-max-all-skills').addEventListener('click', () => {
			for (const key of PLAYABLE_ARCHETYPES) {
				this._maxArchetypeSkills(key);
			}
			this._status('All archetype skills maxed!', 'success');
		});

		document.getElementById('ap-reset-skills').addEventListener('click', () => {
			g.skillManager.reset();
			g._syncPlayerFromSkills();
			this._status('Skills reset.', 'error');
		});

		// ── Attributes ───────────────────────────────────────────────────
		for (const attrKey of Object.keys(ATTRIBUTES)) {
			document.getElementById(`ap-max-${attrKey.toLowerCase()}`).addEventListener('click', () => {
				this._maxAttribute(attrKey);
				this._status(`${attrKey} maxed!`, 'success');
			});
		}

		document.getElementById('ap-max-all-attrs').addEventListener('click', () => {
			for (const attrKey of Object.keys(ATTRIBUTES)) {
				this._maxAttribute(attrKey);
			}
			this._status('All attributes maxed!', 'success');
		});

		document.getElementById('ap-reset-attrs').addEventListener('click', () => {
			const sm = g.skillManager;
			for (const key of Object.keys(ATTRIBUTES)) {
				sm.unspentAttributePoints += sm.attributes[key];
				sm.attributes[key] = 0;
			}
			g._syncPlayerFromSkills();
			this._status('Attributes reset.', 'error');
		});

		// ── Resources ────────────────────────────────────────────────────
		document.getElementById('ap-add-sp50').addEventListener('click', () => {
			g.skillManager.unspentSkillPoints += 50;
			this._status('+50 skill points.', 'success');
		});

		document.getElementById('ap-add-ap50').addEventListener('click', () => {
			g.skillManager.unspentAttributePoints += 50;
			this._status('+50 attribute points.', 'success');
		});

		document.getElementById('ap-add-xp10k').addEventListener('click', () => {
			g.addXP(10000);
			this._status('+10,000 XP.', 'success');
		});

		document.getElementById('ap-add-score50k').addEventListener('click', () => {
			g.score += 50000;
			g.dispatcher?.dispatch({ type: 'SCORE_ADD', payload: { amount: 50000 } });
			this._status('+50,000 Score.', 'success');
		});

		document.getElementById('ap-set-level20').addEventListener('click', () => {
			const sm = g.skillManager;
			while (sm.level < 20) {
				sm.addXP(sm.xpToNextLevel - sm.xp);
			}
			g._syncPlayerFromSkills();
			this._status('Level set to 20.', 'success');
		});

		// ── Player ───────────────────────────────────────────────────────
		document.getElementById('ap-full-heal').addEventListener('click', () => {
			if (g.player) {
				g.player.heal(g.player.maxHp);
				if (g.player.hasShield) {
					g.player.shieldHp = g.player.maxShieldHp;
				}
			}
			this._status('Fully healed.', 'success');
		});

		document.getElementById('ap-god-mode').addEventListener('click', () => {
			if (g.player) {
				g.player._godModeActive = !g.player._godModeActive;
				this._status(`God Mode: ${g.player._godModeActive ? 'ON' : 'OFF'}`, g.player._godModeActive ? 'success' : 'error');
			}
		});

		document.getElementById('ap-kill-all').addEventListener('click', () => {
			for (const enemy of g.enemies) {
				enemy.health = 0;
			}
			this._status('All enemies killed.', 'success');
		});

		// ── Waves ────────────────────────────────────────────────────────
		document.getElementById('ap-skip-wave').addEventListener('click', () => {
			for (const enemy of g.enemies) enemy.health = 0;
			this._status('Wave skipped.', 'success');
		});

		const jumpToWave = (n) => {
			g.wave = n;
			g.enemies.length = 0;
			g.projectiles.length = 0;
			g.waveManager.reset();
			g.waveManager.setDifficulty(g.runDifficulty);
			g.waveManager.startWave(n);
			this._status(`Jumped to wave ${n}.`, 'success');
		};

		document.getElementById('ap-jump-wave10').addEventListener('click', () => jumpToWave(10));
		document.getElementById('ap-jump-wave25').addEventListener('click', () => jumpToWave(25));
		document.getElementById('ap-jump-wave50').addEventListener('click', () => jumpToWave(50));

		// ── Ascension ───────────────────────────────────────────────────
		document.getElementById('ap-asc-offer').addEventListener('click', () => {
			if (!g.ascensionSystem) {
				this._status('Ascension system unavailable.', 'error');
				return;
			}
			g.gameState = 'ascension';
			g.ascensionSystem.generateOptions();
			this._status('Ascension options generated. Pick from Ascension panel.', 'success');
		});

		document.getElementById('ap-asc-random').addEventListener('click', () => {
			const mod = this._grantRandomAscension();
			if (!mod) {
				this._status('No ascension modifiers available.', 'error');
				return;
			}
			this._status(`Ascension granted: ${mod.name}`, 'success');
		});

		document.getElementById('ap-asc-all').addEventListener('click', () => {
			const granted = this._grantAllAscensions();
			if (granted <= 0) {
				this._status('All ascensions already granted.', 'error');
				return;
			}
			this._status(`Granted ${granted} ascension modifier(s).`, 'success');
		});

		// ── Moderator Tools ──────────────────────────────────────────────
		document.getElementById('ap-mod-plus1000').addEventListener('click', () => {
			this._grantModeratorBoost();
			this._status('Moderator boost applied (+1000 everything + all ascensions).', 'success');
		});

		// ── Full Power ───────────────────────────────────────────────────
		document.getElementById('ap-full-power').addEventListener('click', () => {
			// Max all skills
			for (const key of PLAYABLE_ARCHETYPES) {
				this._maxArchetypeSkills(key);
			}
			// Max all attributes
			for (const attrKey of Object.keys(ATTRIBUTES)) {
				this._maxAttribute(attrKey);
			}
			// Level 20
			const sm = g.skillManager;
			while (sm.level < 20) {
				sm.addXP(sm.xpToNextLevel - sm.xp);
			}
			// Full heal
			if (g.player) {
				g.player.heal(g.player.maxHp);
				if (g.player.hasShield) g.player.shieldHp = g.player.maxShieldHp;
				g.player._godModeActive = true;
			}
			// Score
			g.score += 100000;
			g.dispatcher?.dispatch({ type: 'SCORE_ADD', payload: { amount: 100000 } });
			// Ascensions
			this._grantAllAscensions();
			g._syncPlayerFromSkills();
			this._status('🚀 FULL POWER activated! God Mode ON.', 'success');
		});
	}

	// ─── Skill Helpers ───────────────────────────────────────────────────────

	/**
	 * Force-max all skills in a given archetype, bypassing prerequisites and point costs.
	 * @param {string} archetypeKey
	 */
	_maxArchetypeSkills(archetypeKey) {
		const archetype = ARCHETYPES[archetypeKey];
		if (!archetype) return;

		const sm = this.game.skillManager;

		for (const skill of archetype.skills) {
			const maxRank = skill.maxRank || 1;
			const currentRank = sm.skillRanks[skill.id] || 0;

			if (currentRank >= maxRank) continue;

			// Force set to max rank
			const ranksToAdd = maxRank - currentRank;
			sm.skillRanks[skill.id] = maxRank;
			sm.treeInvestment[archetypeKey] = (sm.treeInvestment[archetypeKey] || 0) + ranksToAdd;

			// Auto-equip on first acquisition
			if (currentRank === 0) {
				if (skill.type === 'passive' && !sm.equippedPassives.includes(skill.id)) {
					sm.equippedPassives.push(skill.id);
				}
				if (skill.type === 'active' && !sm.equippedActives.includes(skill.id)) {
					// Only add if under slot limit
					if (sm.equippedActives.length < 3) {
						sm.equippedActives.push(skill.id);
						sm.cooldowns[skill.id] = 0;
					}
				}
				if (skill.type === 'ultimate' && !sm.equippedUltimate) {
					sm.equippedUltimate = skill.id;
					sm.cooldowns[skill.id] = 0;
				}
			}

			// Notify SkillEffectEngine
			if (sm._skillEffectEngine) {
				sm._skillEffectEngine.equipSkill(skill.id, maxRank, skill);
			}
		}

		this.game._syncPlayerFromSkills();
	}

	/**
	 * Force-max a single attribute, gives free points if needed.
	 * @param {string} attrKey
	 */
	_maxAttribute(attrKey) {
		const def = ATTRIBUTES[attrKey];
		if (!def) return;

		const sm = this.game.skillManager;
		const current = sm.attributes[attrKey] || 0;
		const needed = def.maxPoints - current;
		if (needed <= 0) return;

		// Grant free attribute points if the player doesn't have enough
		if (sm.unspentAttributePoints < needed) {
			sm.unspentAttributePoints += needed;
		}

		sm.attributes[attrKey] = def.maxPoints;
		sm.unspentAttributePoints -= needed;

		this.game._syncPlayerFromSkills();
	}

	/**
	 * Apply a specific ascension modifier by id, including plugin equip + consume effects.
	 * @param {string} modId
	 * @returns {boolean}
	 */
	_grantAscension(modId) {
		const g = this.game;
		if (!g?.ascensionSystem) return false;

		const mod = ASCENSION_POOL.find((m) => m.id === modId);
		if (!mod) return false;

		if (!g.ascensionSystem.grantModifier(mod)) return false;

		if (g.skillEffectEngine?.hasPlugin(mod.id)) {
			g.skillEffectEngine.equipSkill(mod.id, 1, mod);
		}

		g._syncPlayerFromSkills();
		return true;
	}

	/**
	 * Grant one random ascension not yet active.
	 * @returns {Object|null}
	 */
	_grantRandomAscension() {
		const g = this.game;
		if (!g?.ascensionSystem) return null;

		const available = ASCENSION_POOL.filter(mod => !g.ascensionSystem.activeModifiers.some(active => active.id === mod.id));
		if (!available.length) return null;

		const mod = available[Math.floor(Math.random() * available.length)];
		return this._grantAscension(mod.id) ? mod : null;
	}

	/**
	 * Grant all ascension modifiers.
	 * @returns {number} Number of newly granted modifiers.
	 */
	_grantAllAscensions() {
		let granted = 0;
		for (const mod of ASCENSION_POOL) {
			if (this._grantAscension(mod.id)) granted++;
		}
		return granted;
	}

	/**
	 * Moderator shortcut: grants massive resources and max progression.
	 */
	_grantModeratorBoost() {
		const g = this.game;
		const sm = g.skillManager;

		for (const key of PLAYABLE_ARCHETYPES) {
			this._maxArchetypeSkills(key);
		}

		for (const attrKey of Object.keys(ATTRIBUTES)) {
			this._maxAttribute(attrKey);
		}

		sm.unspentSkillPoints += 1000;
		sm.unspentAttributePoints += 1000;

		g.addXP(1000000);
		g.score += 1000000;
		g.dispatcher?.dispatch({ type: 'SCORE_ADD', payload: { amount: 1000000 } });

		if (g.player) {
			g.player.heal(g.player.maxHp);
			if (g.player.hasShield) g.player.shieldHp = g.player.maxShieldHp;
			g.player._godModeActive = true;
		}

		this._grantAllAscensions();
		g._syncPlayerFromSkills();
	}

	// ─── Status ──────────────────────────────────────────────────────────────

	_status(msg, type = '') {
		const el = document.getElementById('ap-status');
		if (!el) return;
		el.textContent = msg;
		el.className = `ap-status ${type}`;
	}

	// ─── Public API ──────────────────────────────────────────────────────────

	/** Show the admin panel overlay */
	show() {
		if (!this.overlayEl) return;
		this.visible = true;
		this.overlayEl.classList.add('visible');

		// Focus password input if not authenticated
		if (!this.authenticated) {
			setTimeout(() => {
				const pwInput = /** @type {HTMLInputElement} */ (document.getElementById('ap-password-input'));
				pwInput?.focus();
			}, 50);
		}
	}

	/** Hide the admin panel overlay */
	hide() {
		if (!this.overlayEl) return;
		this.visible = false;
		this.overlayEl.classList.remove('visible');
	}

	/** Toggle visibility */
	toggle() {
		if (this.visible) this.hide();
		else this.show();
	}

	/** Clean up */
	destroy() {
		if (this.overlayEl) {
			this.overlayEl.remove();
			this.overlayEl = null;
			this.panelEl = null;
		}
	}
}
