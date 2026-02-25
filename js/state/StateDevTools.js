/**
 * @fileoverview StateDevTools — visual debug panel for the state machine.
 *
 * Gated entirely behind ?debug=true URL param.
 * Renders a collapsible overlay showing:
 *   - Live state tree with expandable slices
 *   - FSM transition log
 *   - Action log with payload previews
 *   - Changed keys highlighted with flash effect
 *   - Snapshot controls (save/load/export)
 *
 * Styled to match the neon game aesthetic.
 * Updates every 500ms (not per-frame) to avoid performance impact.
 */

const __DEV__ = typeof window !== 'undefined'
	&& new URLSearchParams(window.location.search).get('debug') === 'true';

export class StateDevTools {
	/**
	 * @param {import('./GameStore.js').GameStore} store
	 * @param {import('./GameFSM.js').GameFSM} fsm
	 * @param {import('./ActionDispatcher.js').ActionDispatcher} dispatcher
	 */
	constructor(store, fsm, dispatcher) {
		if (!__DEV__) {
			this.enabled = false;
			return;
		}

		this.enabled = true;
		this.store = store;
		this.fsm = fsm;
		this.dispatcher = dispatcher;

		/** @type {boolean} Whether the panel is expanded */
		this._expanded = false;

		/** @type {Set<string>} Currently expanded slice names */
		this._expandedSlices = new Set();

		/** @type {string} Active tab: 'state' | 'actions' | 'fsm' */
		this._activeTab = 'state';

		/** @type {Object|null} Saved snapshot for comparison */
		this._savedSnapshot = null;

		/** @type {Set<string>} Keys that changed recently (for flash highlight) */
		this._recentChanges = new Set();

		/** @type {number|null} Update interval handle */
		this._updateInterval = null;

		/** @type {HTMLElement|null} Root DOM element */
		this._root = null;

		this._createDOM();
		this._startUpdateLoop();
		this._subscribeToChanges();
	}

	// ─── DOM CREATION ───────────────────────────────────────────────────────────

	_createDOM() {
		// Inject styles
		const style = document.createElement('style');
		style.textContent = this._getStyles();
		document.head.appendChild(style);

		// Root container
		this._root = document.createElement('div');
		this._root.id = 'neon-devtools';
		this._root.className = 'neon-devtools collapsed';
		this._root.innerHTML = this._getTemplate();
		document.body.appendChild(this._root);

		// Wire events
		this._root.querySelector('.neon-devtools-toggle').addEventListener('click', () => {
			this._expanded = !this._expanded;
			this._root.classList.toggle('collapsed', !this._expanded);
			if (this._expanded) this._render();
		});

		// Tab switching
		this._root.querySelectorAll('.neon-devtools-tab').forEach(tab => {
			tab.addEventListener('click', () => {
				this._activeTab = /** @type {HTMLElement} */ (tab).dataset.tab;
				this._root.querySelectorAll('.neon-devtools-tab').forEach(t => t.classList.remove('active'));
				tab.classList.add('active');
				this._render();
			});
		});

		// Snapshot controls
		this._root.querySelector('.neon-devtools-snapshot-save')?.addEventListener('click', () => {
			this._savedSnapshot = this.store.serialize();
			console.log('[DevTools] Snapshot saved', this._savedSnapshot);
		});

		this._root.querySelector('.neon-devtools-snapshot-load')?.addEventListener('click', () => {
			if (this._savedSnapshot) {
				this.store.restore(this._savedSnapshot);
				console.log('[DevTools] Snapshot restored');
			}
		});

		this._root.querySelector('.neon-devtools-snapshot-export')?.addEventListener('click', () => {
			const data = JSON.stringify(this.store.serialize(), null, 2);
			const blob = new Blob([data], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `neon-td-state-${Date.now()}.json`;
			a.click();
			URL.revokeObjectURL(url);
		});
	}

	_getTemplate() {
		return `
			<button class="neon-devtools-toggle" title="State DevTools">🔧 State</button>
			<div class="neon-devtools-panel">
				<div class="neon-devtools-header">
					<div class="neon-devtools-tabs">
						<button class="neon-devtools-tab active" data-tab="state">State</button>
						<button class="neon-devtools-tab" data-tab="actions">Actions</button>
						<button class="neon-devtools-tab" data-tab="fsm">FSM</button>
					</div>
					<div class="neon-devtools-controls">
						<button class="neon-devtools-snapshot-save" title="Save Snapshot">📸</button>
						<button class="neon-devtools-snapshot-load" title="Load Snapshot">📂</button>
						<button class="neon-devtools-snapshot-export" title="Export JSON">💾</button>
					</div>
				</div>
				<div class="neon-devtools-content"></div>
			</div>
		`;
	}

	// ─── RENDERING ──────────────────────────────────────────────────────────────

	_render() {
		if (!this._expanded || !this._root) return;

		const content = this._root.querySelector('.neon-devtools-content');
		if (!content) return;

		switch (this._activeTab) {
			case 'state':
				content.innerHTML = this._renderStateTree();
				this._wireSliceToggles(content);
				break;
			case 'actions':
				content.innerHTML = this._renderActionLog();
				break;
			case 'fsm':
				content.innerHTML = this._renderFSMLog();
				break;
		}
	}

	_renderStateTree() {
		const slices = this.store.getSliceNames();
		let html = `<div class="neon-devtools-fsm-badge">Phase: <strong>${this.fsm.current || 'none'}</strong> | v${this.store.getVersion()}</div>`;

		for (const name of slices) {
			const isOpen = this._expandedSlices.has(name);
			const state = this.store.get(name);
			const keyCount = Object.keys(state).length;

			html += `<div class="neon-devtools-slice">`;
			html += `<div class="neon-devtools-slice-header" data-slice="${name}">`;
			html += `<span class="neon-devtools-arrow">${isOpen ? '▼' : '▶'}</span> `;
			html += `<span class="neon-devtools-slice-name">${name}</span>`;
			html += `<span class="neon-devtools-key-count">(${keyCount})</span>`;
			html += `</div>`;

			if (isOpen) {
				html += `<div class="neon-devtools-slice-body">`;
				for (const [key, value] of Object.entries(state)) {
					const displayValue = this._formatValue(value);
					const isRecent = this._recentChanges.has(`${name}.${key}`);
					html += `<div class="neon-devtools-kv ${isRecent ? 'flash' : ''}">`;
					html += `<span class="neon-devtools-key">${key}:</span> `;
					html += `<span class="neon-devtools-value">${displayValue}</span>`;
					html += `</div>`;
				}
				html += `</div>`;
			}

			html += `</div>`;
		}

		return html;
	}

	_renderActionLog() {
		const log = this.store.getActionLog();
		const recent = log.slice(-30).reverse();

		let html = `<div class="neon-devtools-log-count">${log.length} total actions</div>`;
		for (const entry of recent) {
			const isFSM = entry.type.startsWith('FSM:');
			const cls = isFSM ? 'neon-devtools-log-fsm' : 'neon-devtools-log-action';
			const payload = entry.payload
				? JSON.stringify(entry.payload).substring(0, 80)
				: '';
			html += `<div class="${cls}">`;
			html += `<span class="neon-devtools-log-type">${entry.type}</span>`;
			if (payload) {
				html += ` <span class="neon-devtools-log-payload">${payload}</span>`;
			}
			html += `</div>`;
		}

		return html;
	}

	_renderFSMLog() {
		const history = this.fsm.getHistory();
		const recent = history.slice(-30).reverse();

		let html = `<div class="neon-devtools-fsm-current">Current: <strong>${this.fsm.current || 'none'}</strong></div>`;
		html += `<div class="neon-devtools-fsm-previous">Previous: ${this.fsm.previous || 'none'}</div>`;
		html += `<hr class="neon-devtools-divider">`;

		for (const entry of recent) {
			const elapsed = entry.timestamp ? `${Math.round(entry.timestamp)}ms` : '';
			html += `<div class="neon-devtools-fsm-entry">`;
			html += `<span class="neon-devtools-fsm-from">${entry.from || '(init)'}</span>`;
			html += ` → `;
			html += `<span class="neon-devtools-fsm-to">${entry.to}</span>`;
			html += ` <span class="neon-devtools-fsm-time">${elapsed}</span>`;
			html += `</div>`;
		}

		return html;
	}

	_formatValue(value) {
		if (value === null || value === undefined) return `<em>${value}</em>`;
		if (typeof value === 'boolean') return `<span class="neon-devtools-bool">${value}</span>`;
		if (typeof value === 'number') return `<span class="neon-devtools-num">${value}</span>`;
		if (typeof value === 'string') return `<span class="neon-devtools-str">"${value}"</span>`;
		if (Array.isArray(value)) return `Array(${value.length})`;
		if (typeof value === 'object') return `{${Object.keys(value).length} keys}`;
		return String(value);
	}

	_wireSliceToggles(content) {
		content.querySelectorAll('.neon-devtools-slice-header').forEach(header => {
			header.addEventListener('click', () => {
				const slice = header.dataset.slice;
				if (this._expandedSlices.has(slice)) {
					this._expandedSlices.delete(slice);
				} else {
					this._expandedSlices.add(slice);
				}
				this._render();
			});
		});
	}

	// ─── UPDATES ────────────────────────────────────────────────────────────────

	_startUpdateLoop() {
		this._updateInterval = /** @type {number} */ (/** @type {unknown} */ (setInterval(() => {
			if (this._expanded) {
				this._render();
				// Clear recent changes after render
				this._recentChanges.clear();
			}
		}, 500)));
	}

	_subscribeToChanges() {
		this.store.onAny((slice, changedKeys) => {
			for (const key of changedKeys) {
				this._recentChanges.add(`${slice}.${key}`);
			}
		});
	}

	// ─── CLEANUP ────────────────────────────────────────────────────────────────

	destroy() {
		if (this._updateInterval) {
			clearInterval(this._updateInterval);
		}
		if (this._root) {
			this._root.remove();
		}
	}

	// ─── STYLES ─────────────────────────────────────────────────────────────────

	_getStyles() {
		return `
			#neon-devtools {
				position: fixed;
				top: 8px;
				right: 8px;
				z-index: 99999;
				font-family: 'Courier New', monospace;
				font-size: 11px;
				color: #0ff;
				pointer-events: auto;
			}

			#neon-devtools.collapsed .neon-devtools-panel {
				display: none;
			}

			.neon-devtools-toggle {
				background: rgba(0, 0, 0, 0.85);
				color: #0ff;
				border: 1px solid #0ff;
				padding: 4px 10px;
				cursor: pointer;
				font-family: inherit;
				font-size: 11px;
				border-radius: 4px;
			}

			.neon-devtools-toggle:hover {
				background: rgba(0, 255, 255, 0.15);
			}

			.neon-devtools-panel {
				background: rgba(0, 0, 0, 0.92);
				border: 1px solid #0ff;
				border-radius: 4px;
				margin-top: 4px;
				width: 360px;
				max-height: 500px;
				overflow: hidden;
				display: flex;
				flex-direction: column;
				box-shadow: 0 0 20px rgba(0, 255, 255, 0.2);
			}

			.neon-devtools-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				border-bottom: 1px solid #0ff33;
				padding: 4px;
			}

			.neon-devtools-tabs {
				display: flex;
				gap: 2px;
			}

			.neon-devtools-tab {
				background: transparent;
				color: #888;
				border: 1px solid #333;
				padding: 3px 8px;
				cursor: pointer;
				font-family: inherit;
				font-size: 10px;
				border-radius: 3px;
			}

			.neon-devtools-tab.active {
				color: #0ff;
				border-color: #0ff;
				background: rgba(0, 255, 255, 0.1);
			}

			.neon-devtools-controls {
				display: flex;
				gap: 2px;
			}

			.neon-devtools-controls button {
				background: transparent;
				border: 1px solid #333;
				padding: 2px 6px;
				cursor: pointer;
				border-radius: 3px;
				font-size: 12px;
			}

			.neon-devtools-controls button:hover {
				border-color: #0ff;
			}

			.neon-devtools-content {
				overflow-y: auto;
				max-height: 440px;
				padding: 6px;
			}

			.neon-devtools-fsm-badge {
				color: #f0f;
				padding: 4px 0;
				border-bottom: 1px solid #222;
				margin-bottom: 4px;
			}

			.neon-devtools-slice {
				margin-bottom: 2px;
			}

			.neon-devtools-slice-header {
				cursor: pointer;
				padding: 3px 4px;
				border-radius: 2px;
			}

			.neon-devtools-slice-header:hover {
				background: rgba(0, 255, 255, 0.08);
			}

			.neon-devtools-arrow {
				font-size: 8px;
				display: inline-block;
				width: 12px;
			}

			.neon-devtools-slice-name {
				color: #0ff;
				font-weight: bold;
			}

			.neon-devtools-key-count {
				color: #666;
				margin-left: 4px;
			}

			.neon-devtools-slice-body {
				padding-left: 16px;
				border-left: 1px solid #222;
				margin-left: 6px;
			}

			.neon-devtools-kv {
				padding: 1px 0;
				line-height: 1.4;
			}

			.neon-devtools-kv.flash {
				background: rgba(255, 255, 0, 0.15);
				border-radius: 2px;
			}

			.neon-devtools-key {
				color: #888;
			}

			.neon-devtools-num {
				color: #afa;
			}

			.neon-devtools-str {
				color: #ffa;
			}

			.neon-devtools-bool {
				color: #f8a;
			}

			.neon-devtools-log-count {
				color: #666;
				padding: 2px 0;
				border-bottom: 1px solid #222;
				margin-bottom: 4px;
			}

			.neon-devtools-log-action,
			.neon-devtools-log-fsm {
				padding: 2px 0;
				border-bottom: 1px solid #111;
				line-height: 1.4;
			}

			.neon-devtools-log-type {
				color: #0ff;
				font-weight: bold;
			}

			.neon-devtools-log-fsm .neon-devtools-log-type {
				color: #f0f;
			}

			.neon-devtools-log-payload {
				color: #666;
				font-size: 10px;
			}

			.neon-devtools-fsm-current {
				color: #f0f;
				padding: 4px 0;
			}

			.neon-devtools-fsm-previous {
				color: #666;
				padding: 2px 0;
			}

			.neon-devtools-divider {
				border: none;
				border-top: 1px solid #222;
				margin: 4px 0;
			}

			.neon-devtools-fsm-entry {
				padding: 2px 0;
				border-bottom: 1px solid #111;
			}

			.neon-devtools-fsm-from {
				color: #888;
			}

			.neon-devtools-fsm-to {
				color: #0ff;
				font-weight: bold;
			}

			.neon-devtools-fsm-time {
				color: #444;
				font-size: 9px;
				float: right;
			}
		`;
	}
}
