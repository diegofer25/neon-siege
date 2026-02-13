/**
 * @fileoverview PoE-style radial skill tree renderer (DOM + SVG hybrid)
 *
 * Layout: radial constellation centred on 5 attribute nodes, with 5 archetype
 * sectors radiating outward (skills arranged by tier).
 *
 * SVG handles glowing connection lines and decorative rings.
 * DOM handles interactive skill / attribute nodes and tooltips.
 *
 * Coordinate system: internal 1400 × 960 world, CSS-scaled to fit the viewport.
 */

import {
	ATTRIBUTES,
	ARCHETYPES,
	PLAYABLE_ARCHETYPES,
} from '../config/SkillConfig.js';

// ─── LAYOUT CONSTANTS ──────────────────────────────────────────────────────────

const WORLD_W = 1400;
const WORLD_H = 960;
const CX = WORLD_W / 2;
const CY = WORLD_H / 2 + 10;

const ATTR_RADIUS = 68;
const TIER_RADII = [178, 282, 368, 436];
const SECTOR_SPREAD_DEG = 22;

const NODE_SIZE = 46;
const ATTR_NODE_SIZE = 52;
const ULT_NODE_SIZE = 56;
const HUB_SIZE = 36;

/** Archetype sector angles (0° = 12-o'clock, CW) and linked attribute */
const ARCHETYPE_LAYOUT = {
	GUNNER:       { angle: 0,   attrKey: 'STR'  },
	TECHNOMANCER: { angle: 72,  attrKey: 'DEX'  },
	SENTINEL:     { angle: 144, attrKey: 'VIT'  },
	ENGINEER:     { angle: 216, attrKey: 'INT'  },
	TACTICIAN:    { angle: 288, attrKey: 'LUCK' },
};

const ATTR_ANGLES = {
	STR:  0,
	DEX:  72,
	VIT:  144,
	INT:  216,
	LUCK: 288,
};

const SVG_NS = 'http://www.w3.org/2000/svg';

// ─── GEOMETRY HELPERS ──────────────────────────────────────────────────────────

/** Degrees → radians */
function rad(deg) { return (deg * Math.PI) / 180; }

/** Polar (angle° from 12-o'clock, radius) → screen [x, y] */
function polar(angleDeg, radius) {
	return [
		CX + radius * Math.sin(rad(angleDeg)),
		CY - radius * Math.cos(rad(angleDeg)),
	];
}

// ─── RENDERER CLASS ────────────────────────────────────────────────────────────

export class SkillTreeRenderer {
	/**
	 * @param {HTMLElement} viewport – element that clips & scales the tree world
	 */
	constructor(viewport) {
		/** @type {HTMLElement} */
		this.viewport = viewport;

		/** @type {((skillId: string) => void) | null} */
		this._onSkillLearn = null;

		/** @type {((attrKey: string) => void) | null} */
		this._onAttrAllocate = null;

		/** @private */
		this._tooltipEl = null;
		/** @private */
		this._worldEl = null;
		/** @private */
		this._svgEl = null;
		/** @private */
		this._layout = null;

		// ── Pan & Zoom state ──
		/** @private */ this._zoom = 1;
		/** @private */ this._panX = 0;
		/** @private */ this._panY = 0;
		/** @private */ this._baseScale = 1;
		/** @private */ this._isDragging = false;
		/** @private */ this._dragStartX = 0;
		/** @private */ this._dragStartY = 0;
		/** @private */ this._dragPanStartX = 0;
		/** @private */ this._dragPanStartY = 0;
		/** @private */ this._boundHandlers = null;
	}

	// ── public API ──────────────────────────────────────────────────────────────

	/**
	 * Register callbacks fired when the player interacts with the tree.
	 * @param {(skillId: string) => void} onSkillLearn
	 * @param {(attrKey: string) => void} onAttrAllocate
	 */
	setCallbacks(onSkillLearn, onAttrAllocate) {
		this._onSkillLearn = onSkillLearn;
		this._onAttrAllocate = onAttrAllocate;
	}

	/**
	 * Full (re-)render of the tree.
	 * @param {import('../managers/SkillManager.js').SkillManager} sm
	 */
	render(sm) {
		const isFirstRender = !this._worldEl;
		this.viewport.innerHTML = '';

		// World container (fixed internal size, scaled via CSS)
		this._worldEl = document.createElement('div');
		this._worldEl.className = 'tree-world';
		this._worldEl.style.width = WORLD_W + 'px';
		this._worldEl.style.height = WORLD_H + 'px';

		// SVG layer for edges / rings
		this._svgEl = document.createElementNS(SVG_NS, 'svg');
		this._svgEl.setAttribute('class', 'tree-svg');
		this._svgEl.setAttribute('viewBox', `0 0 ${WORLD_W} ${WORLD_H}`);
		this._svgEl.setAttribute('width', String(WORLD_W));
		this._svgEl.setAttribute('height', String(WORLD_H));
		this._addSVGDefs();
		this._worldEl.appendChild(this._svgEl);

		// Compute positions
		this._layout = this._computeLayout();

		// Draw
		this._renderEdges(sm);
		this._renderHub();
		this._renderAttributeNodes(sm);
		this._renderSkillNodes(sm);

		// Tooltip element
		this._tooltipEl = document.createElement('div');
		this._tooltipEl.className = 'tree-tooltip';
		this._tooltipEl.style.display = 'none';
		this._worldEl.appendChild(this._tooltipEl);

		this.viewport.appendChild(this._worldEl);

		// Compute base scale; focus initial view on pickable/playable branches
		this._baseScale = this._computeBaseScale();
		if (isFirstRender) {
			const bounds = this._computeInitialFocusBounds(sm);
			this._fitViewToBounds(bounds);
		}
		this._applyTransform();
		this._installPanZoom();
	}

	/** Convenience – re-renders to reflect updated SkillManager state. */
	update(sm) { this.render(sm); }

	/** Tear down DOM and event listeners. */
	destroy() {
		this._removePanZoom();
		this.viewport.innerHTML = '';
		this._layout = null;
		this._tooltipEl = null;
		this._worldEl = null;
		this._svgEl = null;
	}

	// ── layout computation ──────────────────────────────────────────────────────

	/** @returns {{ attributes: Object, archetypes: Object, edges: Array }} */
	_computeLayout() {
		const layout = { attributes: {}, archetypes: {}, edges: [] };

		// Attribute positions
		for (const [key, angleDeg] of Object.entries(ATTR_ANGLES)) {
			const [x, y] = polar(angleDeg, ATTR_RADIUS);
			layout.attributes[key] = { x, y, key };
		}

		// Skill positions per archetype
		for (const [archKey, archCfg] of Object.entries(ARCHETYPE_LAYOUT)) {
			const archetype = ARCHETYPES[archKey];
			if (!archetype) continue;

			const nodes = [];
			const byTier = [[], [], [], []];
			for (const skill of archetype.skills) {
				const ti = skill.tier - 1;
				if (ti >= 0 && ti < 4) byTier[ti].push(skill);
			}

			for (let t = 0; t < 4; t++) {
				const skills = byTier[t];
				const count = skills.length;
				if (!count) continue;
				const r = TIER_RADII[t];
				for (let i = 0; i < count; i++) {
					let off = 0;
					if (count > 1) {
						const spread = SECTOR_SPREAD_DEG * 2;
						off = -SECTOR_SPREAD_DEG + (spread / (count - 1)) * i;
					}
					const angle = archCfg.angle + off;
					const [x, y] = polar(angle, r);
					nodes.push({
						skillId: skills[i].id,
						skill: skills[i],
						tier: skills[i].tier,
						type: skills[i].type,
						x, y, angle, radius: r,
					});
				}
			}

			layout.archetypes[archKey] = {
				angle: archCfg.angle,
				color: archetype.color,
				label: archetype.label,
				icon: archetype.icon,
				nodes,
			};
		}

		this._computeEdges(layout);
		return layout;
	}

	/** Build edge list: centre→attrs, attrs→tier1, tierN→tierN+1 */
	_computeEdges(layout) {
		const edges = [];

		// Centre hub → attribute nodes
		for (const [key, attr] of Object.entries(layout.attributes)) {
			edges.push({ x1: CX, y1: CY, x2: attr.x, y2: attr.y, type: 'center-attr', attrKey: key, archKey: null, sourceSkillId: null, targetSkillId: null });
		}

		// Per-archetype edges
		for (const [archKey, archData] of Object.entries(layout.archetypes)) {
			const attrKey = ARCHETYPE_LAYOUT[archKey].attrKey;
			const attrNode = layout.attributes[attrKey];

			// Attribute → tier-1 bridge
			const tier1 = archData.nodes.filter(n => n.tier === 1);
			for (const t1 of tier1) {
				edges.push({ x1: attrNode.x, y1: attrNode.y, x2: t1.x, y2: t1.y, type: 'attr-skill', archKey, sourceSkillId: null, targetSkillId: t1.skillId });
			}

			// Tier N → tier N+1 (closest-neighbour in previous tier)
			for (let t = 1; t < 4; t++) {
				const curr = archData.nodes.filter(n => n.tier === t + 1);
				const prev = archData.nodes.filter(n => n.tier === t);
				for (const c of curr) {
					let best = prev[0];
					let bestD = Infinity;
					for (const p of prev) {
						const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
						if (d < bestD) { bestD = d; best = p; }
					}
					if (best) {
						edges.push({ x1: best.x, y1: best.y, x2: c.x, y2: c.y, type: 'skill-skill', archKey, sourceSkillId: best.skillId, targetSkillId: c.skillId });
					}
				}
			}
		}

		layout.edges = edges;
	}

	// ── SVG rendering ───────────────────────────────────────────────────────────

	_addSVGDefs() {
		const defs = document.createElementNS(SVG_NS, 'defs');

		// Glow filter (normal)
		defs.innerHTML = `
			<filter id="edgeGlow" x="-50%" y="-50%" width="200%" height="200%">
				<feGaussianBlur stdDeviation="4" result="g"/>
				<feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
			</filter>
			<filter id="edgeGlowStrong" x="-50%" y="-50%" width="200%" height="200%">
				<feGaussianBlur stdDeviation="7" result="g"/>
				<feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
			</filter>
			<filter id="nodeGlow" x="-80%" y="-80%" width="260%" height="260%">
				<feGaussianBlur stdDeviation="6" result="g"/>
				<feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
			</filter>
		`;

		this._svgEl.appendChild(defs);
	}

	/** @param {import('../managers/SkillManager.js').SkillManager} sm */
	_renderEdges(sm) {
		const g = document.createElementNS(SVG_NS, 'g');
		g.setAttribute('class', 'tree-edges-group');

		// Decorative tier rings
		for (const r of TIER_RADII) {
			const c = document.createElementNS(SVG_NS, 'circle');
			c.setAttribute('cx', String(CX));
			c.setAttribute('cy', String(CY));
			c.setAttribute('r', String(r));
			c.setAttribute('class', 'tier-ring');
			g.appendChild(c);
		}

		// Edge lines
		for (const edge of this._layout.edges) {
			const line = document.createElementNS(SVG_NS, 'line');
			line.setAttribute('x1', String(edge.x1));
			line.setAttribute('y1', String(edge.y1));
			line.setAttribute('x2', String(edge.x2));
			line.setAttribute('y2', String(edge.y2));

			const archColor = edge.archKey ? (ARCHETYPES[edge.archKey]?.color || '#0ff') : '#0ff';
			let cls = 'tree-edge';

			if (edge.type === 'center-attr') {
				cls += ' tree-edge--attr';
			} else {
				const srcOk = !edge.sourceSkillId || (sm.skillRanks[edge.sourceSkillId] > 0);
				const tgtOk = edge.targetSkillId && sm.skillRanks[edge.targetSkillId] > 0;
				const isChosen = sm.chosenArchetype === edge.archKey;
				const isPlayable = PLAYABLE_ARCHETYPES.includes(edge.archKey);

				if (tgtOk && srcOk) {
					cls += ' tree-edge--active';
					line.style.stroke = archColor;
				} else if (isChosen || (!sm.chosenArchetype && isPlayable)) {
					cls += ' tree-edge--available';
					line.style.stroke = archColor;
				} else {
					cls += ' tree-edge--dim';
				}
			}

			line.setAttribute('class', cls);
			g.appendChild(line);
		}

		this._svgEl.appendChild(g);
	}

	// ── DOM node rendering ──────────────────────────────────────────────────────

	_renderHub() {
		const hub = document.createElement('div');
		hub.className = 'tree-node tree-node--hub';
		hub.style.left = (CX - HUB_SIZE / 2) + 'px';
		hub.style.top = (CY - HUB_SIZE / 2) + 'px';
		hub.style.width = HUB_SIZE + 'px';
		hub.style.height = HUB_SIZE + 'px';
		hub.innerHTML = '<span class="tree-node__icon">⬡</span>';
		this._worldEl.appendChild(hub);
	}

	/** @param {import('../managers/SkillManager.js').SkillManager} sm */
	_renderAttributeNodes(sm) {
		for (const [key, pos] of Object.entries(this._layout.attributes)) {
			const attr = ATTRIBUTES[key];
			const pts = sm.attributes[key] || 0;
			const node = document.createElement('div');
			node.className = 'tree-node tree-node--attr';
			node.style.left = (pos.x - ATTR_NODE_SIZE / 2) + 'px';
			node.style.top = (pos.y - ATTR_NODE_SIZE / 2) + 'px';
			node.style.width = ATTR_NODE_SIZE + 'px';
			node.style.height = ATTR_NODE_SIZE + 'px';

			node.innerHTML = `
				<span class="tree-node__icon">${attr.icon}</span>
				<span class="tree-node__value">${pts}</span>
			`;

			if (sm.unspentAttributePoints > 0 && pts < attr.maxPoints) {
				node.classList.add('tree-node--available');
				const btn = document.createElement('button');
				btn.className = 'tree-node__add';
				btn.textContent = '+';
				btn.onclick = (e) => {
					e.stopPropagation();
					if (this._onAttrAllocate) this._onAttrAllocate(key);
				};
				node.appendChild(btn);
			}

			node.addEventListener('mouseenter', () => {
				this._showTooltip(node, {
					name: attr.label,
					icon: attr.icon,
					description: attr.description,
					extra: `Points: ${pts} / ${attr.maxPoints}`,
					color: '#0ff',
				});
			});
			node.addEventListener('mouseleave', () => this._hideTooltip());

			this._worldEl.appendChild(node);
		}
	}

	/** @param {import('../managers/SkillManager.js').SkillManager} sm */
	_renderSkillNodes(sm) {
		for (const [archKey, archData] of Object.entries(this._layout.archetypes)) {
			const isChosen = sm.chosenArchetype === archKey;
			const isPlayable = PLAYABLE_ARCHETYPES.includes(archKey);
			const isAvailable = isChosen || (!sm.chosenArchetype && isPlayable);
			const isStub = !isPlayable;

			// Sector label at the outermost ring
			this._renderArchLabel(archData, isChosen, isStub);

			// Skill nodes
			for (const nd of archData.nodes) {
				this._renderOneSkillNode(nd, sm, archData, isAvailable);
			}
		}
	}

	/**
	 * @param {Object} archData
	 * @param {boolean} isChosen
	 * @param {boolean} isStub
	 */
	_renderArchLabel(archData, isChosen, isStub) {
		const [lx, ly] = polar(archData.angle, TIER_RADII[3] + 50);
		const el = document.createElement('div');
		el.className = 'tree-arch-label'
			+ (isChosen ? ' tree-arch-label--chosen' : '')
			+ (isStub ? ' tree-arch-label--stub' : '');
		el.style.left = lx + 'px';
		el.style.top = ly + 'px';
		el.style.color = archData.color;
		el.innerHTML = `<span>${archData.icon}</span><span>${archData.label}</span>`;
		this._worldEl.appendChild(el);
	}

	/**
	 * @param {Object} nd – node layout data
	 * @param {import('../managers/SkillManager.js').SkillManager} sm
	 * @param {Object} archData
	 * @param {boolean} isAvailable – archetype is interactable
	 */
	_renderOneSkillNode(nd, sm, archData, isAvailable) {
		const skill = nd.skill;
		const rank = sm.skillRanks[skill.id] || 0;
		const check = sm.canLearnSkill(skill.id);
		const canLearn = check.allowed;
		const isLearned = rank > 0;
		const isMaxed = rank >= skill.maxRank;
		const isUlt = skill.type === 'ultimate';

		const size = isUlt ? ULT_NODE_SIZE : NODE_SIZE;
		const el = document.createElement('div');

		// State class
		let state = 'tree-node--locked';
		if (!isAvailable && !isLearned) state = 'tree-node--dimmed';
		else if (isMaxed) state = 'tree-node--maxed';
		else if (isLearned) state = 'tree-node--learned';
		else if (canLearn && sm.unspentSkillPoints > 0) state = 'tree-node--available';

		el.className = `tree-node tree-node--skill tree-node--${skill.type} ${state}`;
		el.style.left = (nd.x - size / 2) + 'px';
		el.style.top = (nd.y - size / 2) + 'px';
		el.style.width = size + 'px';
		el.style.height = size + 'px';
		el.style.setProperty('--arch-color', archData.color);
		el.dataset.skillId = skill.id;

		// Rank badge
		let rankHtml = '';
		if (skill.maxRank > 1) {
			rankHtml = `<span class="tree-node__rank">${rank}/${skill.maxRank}</span>`;
		} else if (isLearned) {
			rankHtml = '<span class="tree-node__rank">✓</span>';
		}

		el.innerHTML = `<span class="tree-node__icon">${skill.icon}</span>${rankHtml}`;

		// Click to learn / rank up
		if (canLearn && sm.unspentSkillPoints > 0 && isAvailable) {
			el.classList.add('tree-node--clickable');
			el.onclick = () => { if (this._onSkillLearn) this._onSkillLearn(skill.id); };
		}

		// Tooltip
		el.addEventListener('mouseenter', () => {
			const typeLabel = skill.type[0].toUpperCase() + skill.type.slice(1);
			let status = '';
			if (isMaxed) status = '✨ MAX RANK';
			else if (isLearned) status = `Rank ${rank}/${skill.maxRank}`;
			else if (!canLearn) status = `🔒 ${check.reason}`;
			else status = 'Click to learn (1 SP)';

			this._showTooltip(el, {
				name: skill.name,
				icon: skill.icon,
				description: skill.description,
				extra: `${typeLabel} · Tier ${skill.tier}`,
				status,
				color: archData.color,
			});
		});
		el.addEventListener('mouseleave', () => this._hideTooltip());

		this._worldEl.appendChild(el);
	}

	// ── tooltip ─────────────────────────────────────────────────────────────────

	/** @param {HTMLElement} target */
	_showTooltip(target, data) {
		if (!this._tooltipEl) return;

		const nL = parseFloat(target.style.left);
		const nT = parseFloat(target.style.top);
		const nW = parseFloat(target.style.width);

		// Try to position to the right of the node
		let left = nL + nW + 14;
		if (left + 220 > WORLD_W) left = nL - 234; // flip left if overflowing
		let top = nT;
		if (top + 160 > WORLD_H) top = WORLD_H - 170;
		if (top < 10) top = 10;

		this._tooltipEl.style.left = left + 'px';
		this._tooltipEl.style.top = top + 'px';

		const col = data.color || '#0ff';
		this._tooltipEl.innerHTML = `
			<div class="tree-tooltip__header" style="color:${col}">
				<span>${data.icon || ''}</span>
				<span class="tree-tooltip__name">${data.name}</span>
			</div>
			<div class="tree-tooltip__extra">${data.extra || ''}</div>
			<div class="tree-tooltip__desc">${data.description}</div>
			${data.status ? `<div class="tree-tooltip__status">${data.status}</div>` : ''}
		`;
		this._tooltipEl.style.display = 'block';
	}

	_hideTooltip() {
		if (this._tooltipEl) this._tooltipEl.style.display = 'none';
	}

	// ── pan & zoom ─────────────────────────────────────────────────────────────

	/** Compute the initial scale that fits the world inside the viewport. */
	_computeBaseScale() {
		const vpW = this.viewport.clientWidth || 800;
		const vpH = this.viewport.clientHeight || 600;
		return Math.min(vpW / WORLD_W, vpH / WORLD_H);
	}

	/**
	 * Compute world bounds for the initial camera focus.
	 * Focuses only playable trees (or chosen archetype) plus their linked attributes.
	 */
	_computeInitialFocusBounds(sm) {
		const focusArchKeys = sm.chosenArchetype
			? [sm.chosenArchetype]
			: PLAYABLE_ARCHETYPES.filter((key) => !!this._layout.archetypes[key]);

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		const includeNode = (x, y, size) => {
			const half = size / 2;
			minX = Math.min(minX, x - half);
			minY = Math.min(minY, y - half);
			maxX = Math.max(maxX, x + half);
			maxY = Math.max(maxY, y + half);
		};

		includeNode(CX, CY, HUB_SIZE);

		for (const archKey of focusArchKeys) {
			const archLayout = this._layout.archetypes[archKey];
			if (!archLayout) continue;

			const attrKey = ARCHETYPE_LAYOUT[archKey]?.attrKey;
			const attrPos = attrKey ? this._layout.attributes[attrKey] : null;
			if (attrPos) includeNode(attrPos.x, attrPos.y, ATTR_NODE_SIZE);

			for (const node of archLayout.nodes) {
				const size = node.type === 'ultimate' ? ULT_NODE_SIZE : NODE_SIZE;
				includeNode(node.x, node.y, size);
			}
		}

		if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
			return { minX: 0, minY: 0, maxX: WORLD_W, maxY: WORLD_H };
		}

		const pad = 56;
		return {
			minX: Math.max(0, minX - pad),
			minY: Math.max(0, minY - pad),
			maxX: Math.min(WORLD_W, maxX + pad),
			maxY: Math.min(WORLD_H, maxY + pad),
		};
	}

	/** Fit current camera transform to world-space bounds. */
	_fitViewToBounds(bounds) {
		const vpW = this.viewport.clientWidth || 800;
		const vpH = this.viewport.clientHeight || 600;

		const width = Math.max(120, bounds.maxX - bounds.minX);
		const height = Math.max(120, bounds.maxY - bounds.minY);
		const usableW = Math.max(120, vpW - 80);
		const usableH = Math.max(120, vpH - 80);

		const desiredScale = Math.min(usableW / width, usableH / height);
		const baseScale = this._computeBaseScale();
		this._baseScale = baseScale;
		this._zoom = Math.min(4, Math.max(0.35, desiredScale / baseScale));

		const finalScale = this._baseScale * this._zoom;
		const centerX = (bounds.minX + bounds.maxX) / 2;
		const centerY = (bounds.minY + bounds.maxY) / 2;
		this._panX = (WORLD_W / 2 - centerX) * finalScale;
		this._panY = (WORLD_H / 2 - centerY) * finalScale;
	}

	/** Apply current zoom + pan transform to the world element. */
	_applyTransform() {
		if (!this._worldEl) return;
		const s = this._baseScale * this._zoom;
		const vpW = this.viewport.clientWidth || 800;
		const vpH = this.viewport.clientHeight || 600;
		// Centre the world, then offset by pan
		const cx = (vpW - WORLD_W * s) / 2 + this._panX;
		const cy = (vpH - WORLD_H * s) / 2 + this._panY;
		this._worldEl.style.transformOrigin = 'top left';
		this._worldEl.style.transform = `translate(${cx}px, ${cy}px) scale(${s})`;
	}

	/** Install wheel-zoom and drag-pan listeners on the viewport. */
	_installPanZoom() {
		this._removePanZoom(); // idempotent

		const onWheel = (e) => {
			e.preventDefault();
			const zoomSpeed = 0.12;
			const dir = e.deltaY < 0 ? 1 : -1;
			const oldZoom = this._zoom;
			this._zoom = Math.min(4, Math.max(0.35, this._zoom * (1 + dir * zoomSpeed)));
			const ratio = this._zoom / oldZoom;

			// Zoom towards cursor position
			const rect = this.viewport.getBoundingClientRect();
			const mx = e.clientX - rect.left;
			const my = e.clientY - rect.top;
			const vpW = this.viewport.clientWidth || 800;
			const vpH = this.viewport.clientHeight || 600;
			const cx0 = (vpW / 2) + this._panX;
			const cy0 = (vpH / 2) + this._panY;
			this._panX -= (mx - cx0) * (ratio - 1);
			this._panY -= (my - cy0) * (ratio - 1);
			this._applyTransform();
		};

		const onPointerDown = (e) => {
			// Only pan with left/middle button on the viewport background
			if (e.button > 1) return;
			if (/** @type {HTMLElement} */ (e.target).closest('.tree-node, .tree-tooltip')) return;
			this._isDragging = true;
			this._dragStartX = e.clientX;
			this._dragStartY = e.clientY;
			this._dragPanStartX = this._panX;
			this._dragPanStartY = this._panY;
			this.viewport.style.cursor = 'grabbing';
			e.preventDefault();
		};

		const onPointerMove = (e) => {
			if (!this._isDragging) return;
			this._panX = this._dragPanStartX + (e.clientX - this._dragStartX);
			this._panY = this._dragPanStartY + (e.clientY - this._dragStartY);
			this._applyTransform();
		};

		const onPointerUp = () => {
			if (!this._isDragging) return;
			this._isDragging = false;
			this.viewport.style.cursor = 'grab';
		};

		this.viewport.addEventListener('wheel', onWheel, { passive: false });
		this.viewport.addEventListener('pointerdown', onPointerDown);
		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onPointerUp);
		this.viewport.style.cursor = 'grab';

		this._boundHandlers = { onWheel, onPointerDown, onPointerMove, onPointerUp };
	}

	/** Remove pan/zoom event listeners. */
	_removePanZoom() {
		if (!this._boundHandlers) return;
		const h = this._boundHandlers;
		this.viewport.removeEventListener('wheel', h.onWheel);
		this.viewport.removeEventListener('pointerdown', h.onPointerDown);
		window.removeEventListener('pointermove', h.onPointerMove);
		window.removeEventListener('pointerup', h.onPointerUp);
		this._boundHandlers = null;
	}
}
