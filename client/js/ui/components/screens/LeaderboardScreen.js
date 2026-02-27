/**
 * @fileoverview <leaderboard-screen> — leaderboard overlay with difficulty tabs
 * and a click-to-open run details panel (with skill/ascension/attribute images).
 *
 * Public API:
 *   show() / hide()
 *   loadLeaderboard(difficulty?) — fetch and render
 *
 * Events (composed, bubbling):
 *   'leaderboard-close'
 */

import { BaseComponent } from '../BaseComponent.js';
import { overlayStyles, createSheet } from '../shared-styles.js';
import { apiFetch } from '../../../services/ApiClient.js';
import { skillIconHtml } from '../../../utils/IconUtils.js';

const ASCENSION_NAMES = {
    asc_ricochet: 'Ricochet Rounds',
    asc_death_explosions: 'Volatile Death',
    asc_double_cd: 'Overclock Protocol',
    asc_glass_cannon: 'Glass Cannon',
    asc_vampiric: 'Vampiric Touch',
    asc_bullet_time: 'Bullet Time',
    asc_xp_surge: 'Knowledge Surge',
    asc_thick_skin: 'Thick Skin',
    asc_chain_reaction: 'Chain Reaction',
    asc_treasure_hunter: 'Treasure Hunter',
    asc_rapid_evolution: 'Rapid Evolution',
    asc_berserker: 'Berserker',
    asc_shield_nova: 'Shield Nova',
    asc_echo: 'Echo Strike',
};

/* ── SVG icons ────────────────────────────────────────────────────────────── */
const TROPHY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`;
const SPINNER_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-opacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></path></svg>`;
const ARROW_LEFT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`;

/* ── Styles ───────────────────────────────────────────────────────────────── */
const styles = createSheet(/* css */ `
  :host { display: contents; }

  /* ── Container card ───────────────────────────────────────────────────── */
  .lb-container {
    position: relative;
    width: min(720px, 92vw);
    height: calc(100vh - 40px);
    max-height: calc(100vh - 40px);
    display: flex;
    flex-direction: column;
    padding: var(--spacing-xl) var(--spacing-xxl);
    background: rgba(5, 1, 10, 0.92);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(0, 255, 255, 0.15);
    border-radius: var(--radius-xxl);
    box-shadow:
      0 0 30px rgba(0, 255, 255, 0.08),
      0 0 60px rgba(143, 0, 255, 0.06),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .lb-container::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 3px,
      rgba(0, 255, 255, 0.012) 3px,
      rgba(0, 255, 255, 0.012) 4px
    );
    pointer-events: none;
  }

  /* ── Close button (overlay top-right) ──────────────────────────────────── */
  .close-btn {
    position: absolute !important;
    top: 16px;
    right: 16px;
    width: 40px;
    height: 40px;
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5) !important;
    color: #888;
    font-size: 22px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    z-index: 2;
    line-height: 1;
    padding: 0 !important;
    margin: 0 !important;
    box-shadow: none !important;
    letter-spacing: 0 !important;
    overflow: visible !important;
    min-width: 0 !important;
    text-transform: none !important;
  }
  .close-btn::before { display: none !important; }
  .close-btn:hover {
    color: #fff;
    border-color: var(--color-primary-neon) !important;
    box-shadow: 0 0 8px rgba(0, 255, 255, 0.3) !important;
    animation: none !important;
    transform: none !important;
  }

  /* ── Header ───────────────────────────────────────────────────────────── */
  .lb-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: var(--spacing-lg);
  }
  .lb-header-icon {
    width: 28px;
    height: 28px;
    color: var(--color-secondary-neon);
    filter: drop-shadow(0 0 6px var(--color-secondary-neon));
  }
  .lb-heading {
    font-family: var(--font-pixel);
    color: var(--color-secondary-neon);
    text-shadow:
      0 0 6px var(--color-secondary-neon),
      0 0 14px var(--color-secondary-neon),
      0 0 28px var(--color-secondary-neon);
    font-size: 22px;
    letter-spacing: 3px;
    animation: neonFlicker 3s infinite alternate;
    margin: 0;
  }

  /* ── Tabs ──────────────────────────────────────────────────────────────── */
  .lb-tabs {
    display: flex;
    gap: 4px;
    justify-content: center;
    margin-bottom: var(--spacing-md);
  }
  .lb-tab {
    padding: 8px 22px !important;
    font-size: 12px;
    font-family: var(--font-pixel);
    border: 1px solid rgba(0, 255, 255, 0.2) !important;
    border-radius: var(--radius-sm);
    background: rgba(0, 0, 0, 0.4) !important;
    color: #777;
    cursor: pointer;
    transition: all 0.25s;
    text-transform: uppercase;
    letter-spacing: 1px !important;
    box-shadow: none !important;
    margin: 0 !important;
    overflow: visible !important;
    position: relative !important;
  }
  .lb-tab::before { display: none !important; }
  .lb-tab:hover {
    border-color: var(--color-secondary-neon) !important;
    color: #ccc;
    background: rgba(0, 255, 255, 0.05) !important;
    animation: none !important;
    transform: none !important;
  }
  .lb-tab.active {
    border-color: var(--color-primary-neon) !important;
    background: rgba(0, 255, 255, 0.12) !important;
    color: var(--color-primary-neon);
    box-shadow: 0 0 10px rgba(0, 255, 255, 0.2), inset 0 0 8px rgba(0, 255, 255, 0.06) !important;
  }

  /* ── Body area — table and details panel share the same space ──────────── */
  .lb-body {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* ── Table wrapper ────────────────────────────────────────────────────── */
  .lb-table-wrap {
    overflow-y: auto;
    height: 100%;
    border: 1px solid rgba(0, 255, 255, 0.15);
    border-radius: var(--radius-md);
    background: rgba(0, 0, 0, 0.3);
    min-height: 200px;
    transition: opacity 0.2s;
  }
  .lb-table-wrap.hidden { opacity: 0; pointer-events: none; }
  .lb-table-wrap::-webkit-scrollbar { width: 6px; }
  .lb-table-wrap::-webkit-scrollbar-track { background: transparent; }
  .lb-table-wrap::-webkit-scrollbar-thumb {
    background: rgba(0, 255, 255, 0.2);
    border-radius: 3px;
  }

  /* ── Table ────────────────────────────────────────────────────────────── */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th {
    position: sticky;
    top: 0;
    background: rgba(5, 1, 10, 0.97);
    padding: 10px 14px;
    text-align: left;
    font-family: var(--font-pixel);
    font-size: 10px;
    color: var(--color-primary-neon);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    border-bottom: 1px solid rgba(0, 255, 255, 0.3);
  }
  td {
    padding: 10px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    color: #bbb;
    transition: background 0.15s;
  }
  tr { transition: background 0.15s; }
  tr:hover td { background: rgba(0, 255, 255, 0.04); }

  tbody tr {
    animation: rowFadeIn 0.3s ease backwards;
  }
  tbody tr:nth-child(1)  { animation-delay: 0.05s; }
  tbody tr:nth-child(2)  { animation-delay: 0.08s; }
  tbody tr:nth-child(3)  { animation-delay: 0.11s; }
  tbody tr:nth-child(4)  { animation-delay: 0.14s; }
  tbody tr:nth-child(5)  { animation-delay: 0.17s; }
  tbody tr:nth-child(6)  { animation-delay: 0.20s; }
  tbody tr:nth-child(7)  { animation-delay: 0.23s; }
  tbody tr:nth-child(8)  { animation-delay: 0.26s; }
  tbody tr:nth-child(9)  { animation-delay: 0.29s; }
  tbody tr:nth-child(10) { animation-delay: 0.32s; }
  @keyframes rowFadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Rank cells ───────────────────────────────────────────────────────── */
  .rank-cell {
    font-family: var(--font-pixel);
    font-size: 12px;
    color: var(--color-primary-neon);
    width: 54px;
    text-align: center;
  }
  .rank-1 { color: #ffd700; text-shadow: 0 0 8px #ffd700, 0 0 16px rgba(255,215,0,0.4); font-size: 13px; }
  .rank-2 { color: #c0c0c0; text-shadow: 0 0 6px #c0c0c0; }
  .rank-3 { color: #cd7f32; text-shadow: 0 0 6px #cd7f32; }

  .rank-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    font-size: 12px;
    font-weight: bold;
  }
  .rank-1 .rank-badge { background: rgba(255,215,0,0.15); border: 1px solid rgba(255,215,0,0.5); }
  .rank-2 .rank-badge { background: rgba(192,192,192,0.12); border: 1px solid rgba(192,192,192,0.4); }
  .rank-3 .rank-badge { background: rgba(205,127,50,0.12); border: 1px solid rgba(205,127,50,0.4); }

  .name-cell { font-weight: 600; color: #eee; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .score-cell { font-family: var(--font-pixel); font-size: 12px; color: var(--color-primary-neon); text-shadow: 0 0 4px var(--color-primary-neon); }
  .wave-cell { font-family: var(--font-pixel); font-size: 12px; }
  .victory-badge { color: #ffd700; font-size: 11px; margin-left: 4px; filter: drop-shadow(0 0 4px #ffd700); }

  /* ── Stats button ──────────────────────────────────────────────────────── */
  .stats-cell { text-align: center; }
  .stats-btn {
    display: inline-flex !important;
    align-items: center;
    gap: 4px;
    padding: 4px 10px !important;
    font-size: 10px;
    font-family: var(--font-pixel);
    border: 1px solid rgba(0, 255, 255, 0.25) !important;
    border-radius: var(--radius-sm);
    background: rgba(0, 255, 255, 0.06) !important;
    color: var(--color-primary-neon);
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: none !important;
    letter-spacing: 0 !important;
    text-transform: uppercase !important;
    margin: 0 !important;
    white-space: nowrap;
  }
  .stats-btn::before { display: none !important; }
  .stats-btn:hover {
    border-color: var(--color-primary-neon) !important;
    background: rgba(0, 255, 255, 0.15) !important;
    box-shadow: 0 0 8px rgba(0, 255, 255, 0.25) !important;
    animation: none !important;
    transform: none !important;
  }

  /* ── Run details panel ─────────────────────────────────────────────────── */
  .rdp-panel {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: rgba(5, 1, 10, 0.97);
    border: 1px solid rgba(0, 255, 255, 0.2);
    border-radius: var(--radius-md);
    overflow: hidden;
    opacity: 0;
    transform: translateX(20px);
    pointer-events: none;
    transition: opacity 0.2s ease, transform 0.2s ease;
  }
  .rdp-panel.visible {
    opacity: 1;
    transform: translateX(0);
    pointer-events: all;
  }

  /* Panel header */
  .rdp-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(0, 255, 255, 0.15);
    flex-shrink: 0;
  }
  .rdp-back {
    display: inline-flex !important;
    align-items: center;
    gap: 6px;
    background: none !important;
    border: none !important;
    color: #888;
    font-family: var(--font-primary);
    font-size: 12px;
    cursor: pointer;
    padding: 4px 0 !important;
    transition: color 0.2s;
    box-shadow: none !important;
    letter-spacing: 0 !important;
    text-transform: none !important;
    margin: 0 !important;
  }
  .rdp-back::before { display: none !important; }
  .rdp-back:hover { color: var(--color-primary-neon); animation: none !important; transform: none !important; }
  .rdp-back svg { width: 14px; height: 14px; }
  .rdp-player {
    flex: 1;
    font-family: var(--font-pixel);
    font-size: 13px;
    color: var(--color-primary-neon);
    text-shadow: 0 0 6px var(--color-primary-neon);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rdp-meta {
    font-size: 11px;
    color: #666;
    flex-shrink: 0;
  }

  /* Panel body */
  .rdp-body {
    overflow-y: auto;
    flex: 1;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .rdp-body::-webkit-scrollbar { width: 4px; }
  .rdp-body::-webkit-scrollbar-track { background: transparent; }
  .rdp-body::-webkit-scrollbar-thumb { background: rgba(0,255,255,0.2); border-radius: 2px; }

  /* Sections */
  .rdp-section h4 {
    font-family: var(--font-pixel);
    font-size: 10px;
    color: var(--color-primary-neon);
    text-transform: uppercase;
    letter-spacing: 2px;
    margin: 0 0 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(0, 255, 255, 0.1);
  }

  /* Attributes grid */
  .rdp-attrs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .rdp-attr-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-sm);
    background: rgba(0, 0, 0, 0.3);
    min-width: 58px;
  }
  .rdp-attr-item .attr-icon { width: 28px; height: 28px; border-radius: 4px; object-fit: cover; }
  .rdp-attr-item .attr-label { font-size: 10px; color: #666; }
  .rdp-attr-item .attr-value { font-family: var(--font-pixel); font-size: 13px; color: var(--color-primary-neon); text-shadow: 0 0 4px var(--color-primary-neon); }
  .skill-icon-img { border-radius: 4px; object-fit: cover; }

  /* Combat stats */
  .rdp-stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .rdp-stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 10px;
    background: rgba(0,0,0,0.2);
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.04);
  }
  .rdp-stat-label { font-size: 11px; color: #666; }
  .rdp-stat-value { font-family: var(--font-pixel); font-size: 11px; color: #ccc; }
  .rdp-flag-row { grid-column: 1 / -1; }

  /* Ascension grid */
  .rdp-asc-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .rdp-asc-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border: 1px solid rgba(255, 45, 236, 0.2);
    border-radius: var(--radius-sm);
    background: rgba(255, 45, 236, 0.06);
  }
  .rdp-asc-item .asc-icon { width: 28px; height: 28px; border-radius: 4px; object-fit: cover; flex-shrink: 0; }
  .rdp-asc-item .asc-name { font-size: 12px; color: var(--color-secondary-neon); }

  /* Skills grid */
  .rdp-skills-group { margin-bottom: 10px; }
  .rdp-skills-group-label {
    font-size: 10px;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 6px;
  }
  .rdp-skills-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .rdp-skill-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border: 1px solid rgba(0, 255, 255, 0.12);
    border-radius: var(--radius-sm);
    background: rgba(0, 0, 0, 0.3);
  }
  .rdp-skill-item .skill-icon { width: 28px; height: 28px; border-radius: 4px; flex-shrink: 0; font-size: 20px; display: flex; align-items: center; justify-content: center; }
  .rdp-skill-item .skill-info { display: flex; flex-direction: column; gap: 1px; }
  .rdp-skill-item .skill-name { font-size: 12px; color: #ccc; }
  .rdp-skill-item .skill-rank { font-family: var(--font-pixel); font-size: 10px; color: var(--color-primary-neon); }

  /* ── Loading / Empty / Error states ───────────────────────────────────── */
  .lb-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: var(--spacing-xxl);
    color: #888;
    font-size: 13px;
  }
  .lb-loading-spinner { width: 32px; height: 32px; color: var(--color-primary-neon); opacity: 0.7; }
  .lb-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: var(--spacing-xxl);
    color: #555;
    font-size: 14px;
  }
  .lb-empty-icon { font-size: 28px; opacity: 0.4; }
  .lb-error { text-align: center; padding: var(--spacing-xl); color: var(--color-accent-red); font-size: 13px; }

  /* ── User rank banner ─────────────────────────────────────────────────── */
  .lb-user-rank {
    margin-top: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid rgba(0, 255, 255, 0.2);
    border-radius: var(--radius-sm);
    background: rgba(0, 255, 255, 0.05);
    font-size: 13px;
    text-align: center;
    color: #999;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .lb-user-rank strong { color: var(--color-primary-neon); font-family: var(--font-pixel); text-shadow: 0 0 4px var(--color-primary-neon); }

  /* ── Responsive ───────────────────────────────────────────────────────── */
  @media (max-width: 600px) {
    .lb-container { width: 96vw; height: calc(100vh - 24px); max-height: calc(100vh - 24px); padding: var(--spacing-md) var(--spacing-md); border-radius: var(--radius-lg); }
    .lb-heading { font-size: 16px; letter-spacing: 2px; }
    .lb-tab { padding: 6px 14px !important; font-size: 10px; }
    th { padding: 8px 8px; font-size: 9px; }
    td { padding: 8px 8px; font-size: 12px; }
    .name-cell { max-width: 100px; }
    .rdp-stats-grid { grid-template-columns: 1fr; }
  }

  @keyframes neonFlicker {
    0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% {
      text-shadow:
        0 0 6px var(--color-secondary-neon),
        0 0 14px var(--color-secondary-neon),
        0 0 28px var(--color-secondary-neon);
    }
    20%, 24%, 55% { text-shadow: none; }
  }
`);


class LeaderboardScreen extends BaseComponent {
    connectedCallback() {
        this._currentDifficulty = 'normal';
        this._data = null;

        this._render(/* html */ `
            <div class="overlay">
                <button class="close-btn" aria-label="Close">&times;</button>
                <div class="lb-container">
                    <div class="lb-header">
                        <span class="lb-header-icon">${TROPHY_ICON}</span>
                        <h2 class="lb-heading">LEADERBOARD</h2>
                    </div>
                    <div class="lb-tabs" id="tabs">
                        <button class="lb-tab" data-diff="easy">Easy</button>
                        <button class="lb-tab active" data-diff="normal">Normal</button>
                        <button class="lb-tab" data-diff="hard">Hard</button>
                    </div>
                    <div class="lb-body">
                        <div class="lb-table-wrap" id="tableWrap">
                            <div class="lb-loading">
                                <span class="lb-loading-spinner">${SPINNER_SVG}</span>
                                Loading…
                            </div>
                        </div>
                        <div class="rdp-panel" id="rdpPanel"></div>
                    </div>
                    <div class="lb-user-rank" id="userRank" style="display: none;"></div>
                </div>
            </div>
        `, overlayStyles, styles);

        // Tab switching
        this._$('#tabs').addEventListener('click', (e) => {
            const tab = /** @type {HTMLElement} */ (e.target).closest('.lb-tab');
            if (!tab) return;
            this._hideRunDetails();
            this.loadLeaderboard(/** @type {HTMLElement} */ (tab).dataset.diff);
        });

        // Close leaderboard
        this._$('.close-btn').addEventListener('click', () => {
            this.hide();
            this._emit('leaderboard-close');
        });
    }

    /* ── Animated show / hide ───────────────────────────────────────────── */
    show() {
        super.show();
        this._hideRunDetails();
        this.loadLeaderboard(this._currentDifficulty);
    }

    hide() {
        const root = this._$('.overlay');
        if (!root || !root.classList.contains('show')) return;
        root.classList.add('hide');
        root.addEventListener('animationend', () => {
            root.classList.remove('show', 'hide');
        }, { once: true });
    }

    /** @param {string} [difficulty] */
    async loadLeaderboard(difficulty = 'normal') {
        this._currentDifficulty = difficulty;

        this._$$('.lb-tab').forEach(/** @param {Element} t */ t =>
            t.classList.toggle('active', /** @type {HTMLElement} */ (t).dataset.diff === difficulty)
        );

        const wrap = this._$('#tableWrap');
        wrap.innerHTML = `
            <div class="lb-loading">
                <span class="lb-loading-spinner">${SPINNER_SVG}</span>
                Loading…
            </div>`;
        this._$('#userRank').style.display = 'none';

        try {
            const data = await apiFetch(`/api/leaderboard?difficulty=${difficulty}&limit=50`);
            this._data = data;
            this._renderTable(data);
        } catch {
            wrap.innerHTML = `<div class="lb-error">Could not load leaderboard</div>`;
        }
    }

    /** @param {{ entries: any[], total: number, userRank: number|null }} data */
    _renderTable(data) {
        const wrap = this._$('#tableWrap');

        if (!data.entries || data.entries.length === 0) {
            wrap.innerHTML = `
                <div class="lb-empty">
                    <span class="lb-empty-icon">🏆</span>
                    No entries yet — be the first!
                </div>`;
            return;
        }

        const rows = data.entries.map((entry, i) => {
            const rank = entry.rank || i + 1;
            const rankClass = rank <= 3 ? ` rank-${rank}` : '';
            const victoryBadge = entry.is_victory ? '<span class="victory-badge">★</span>' : '';
            const rankContent = rank <= 3 ? `<span class="rank-badge">${rank}</span>` : `#${rank}`;

            return `<tr>
                <td class="rank-cell${rankClass}">${rankContent}</td>
                <td class="name-cell">${this._esc(entry.display_name)}</td>
                <td class="score-cell">${entry.score.toLocaleString()}</td>
                <td class="wave-cell">W${entry.wave}${victoryBadge}</td>
                <td class="stats-cell">
                    <button class="stats-btn" data-idx="${i}">View Stats</button>
                </td>
            </tr>`;
        }).join('');

        wrap.innerHTML = `
            <table>
                <thead><tr>
                    <th>Rank</th><th>Player</th><th>Score</th><th>Wave</th><th>Stats</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;

        wrap.addEventListener('click', (e) => {
            const btn = /** @type {HTMLElement} */ (e.target).closest('.stats-btn');
            if (!btn) return;
            const idx = parseInt(/** @type {HTMLElement} */ (btn).dataset.idx);
            if (!isNaN(idx)) this._showRunDetails(data.entries[idx]);
        });

        // User rank banner
        const rankEl = this._$('#userRank');
        if (data.userRank != null) {
            rankEl.innerHTML = `Your best rank: <strong>#${data.userRank}</strong> on ${this._currentDifficulty}`;
            rankEl.style.display = 'flex';
        }
    }

    /* ── Run details panel ──────────────────────────────────────────────── */
    /** @param {any} entry */
    _showRunDetails(entry) {
        const panel = this._$('#rdpPanel');
        const rd = entry.run_details || {};

        panel.innerHTML = `
            <div class="rdp-header">
                <button class="rdp-back" id="rdpBack">${ARROW_LEFT} Back</button>
                <span class="rdp-player">${this._esc(entry.display_name)}</span>
                <span class="rdp-meta">W${entry.wave} · ${entry.score.toLocaleString()} pts${entry.is_victory ? ' ★' : ''}</span>
            </div>
            <div class="rdp-body">
                ${this._buildAttrsSection(rd.attributes)}
                ${this._buildStatsSection(rd.stats)}
                ${this._buildAscensionsSection(rd.ascensions)}
                ${this._buildSkillsSection(rd.skills)}
            </div>
        `;

        panel.querySelector('#rdpBack').addEventListener('click', () => this._hideRunDetails());

        // Slide in panel, fade out table
        this._$('#tableWrap').classList.add('hidden');
        this._$('#userRank').style.display = 'none';
        panel.classList.add('visible');
    }

    _hideRunDetails() {
        const panel = this._$('#rdpPanel');
        if (!panel) return;
        panel.classList.remove('visible');
        this._$('#tableWrap')?.classList.remove('hidden');
        // Restore user rank if data loaded
        if (this._data?.userRank != null) {
            const rankEl = this._$('#userRank');
            if (rankEl) rankEl.style.display = 'flex';
        }
    }

    /* ── Section builders ───────────────────────────────────────────────── */

    /** @param {object|undefined} attributes */
    _buildAttrsSection(attributes) {
        if (!attributes) return '';
        const attrDefs = [
            { key: 'STR', label: 'Strength', icon: 'attr_str' },
            { key: 'DEX', label: 'Dexterity', icon: 'attr_dex' },
            { key: 'VIT', label: 'Vitality', icon: 'attr_vit' },
            { key: 'INT', label: 'Intelligence', icon: 'attr_int' },
            { key: 'LUCK', label: 'Luck', icon: 'attr_luck' },
        ];
        const items = attrDefs.map(({ key, label, icon }) => {
            const val = attributes[key] ?? 0;
            const img = skillIconHtml({ iconImage: `assets/icons/skills/${icon}.jpg`, name: label }, 28);
            return `<div class="rdp-attr-item">
                ${img}
                <span class="attr-label">${key}</span>
                <span class="attr-value">${val}</span>
            </div>`;
        }).join('');
        return `<div class="rdp-section"><h4>Attributes</h4><div class="rdp-attrs">${items}</div></div>`;
    }

    /** @param {object|undefined} stats */
    _buildStatsSection(stats) {
        if (!stats) return '';
        const rows = [];
        if (stats.damageMod != null) rows.push(this._statRow('Damage Mod', `${stats.damageMod.toFixed(2)}x`));
        if (stats.fireRateMod != null) rows.push(this._statRow('Fire Rate Mod', `${stats.fireRateMod.toFixed(2)}x`));
        if (stats.maxHp != null) rows.push(this._statRow('Max HP', stats.maxHp));
        if (stats.maxShieldHp) rows.push(this._statRow('Shield HP', stats.maxShieldHp));
        if (stats.piercingLevel) rows.push(this._statRow('Pierce Level', stats.piercingLevel));
        const flags = [];
        if (stats.hasTripleShot) flags.push('Triple Shot');
        if (stats.hasHomingShots) flags.push('Homing');
        if (stats.explosiveShots) flags.push('Explosive');
        if (flags.length) rows.push(`<div class="rdp-stat-row rdp-flag-row"><span class="rdp-stat-label">Abilities</span><span class="rdp-stat-value">${flags.join(' · ')}</span></div>`);
        if (!rows.length) return '';
        return `<div class="rdp-section"><h4>Combat Stats</h4><div class="rdp-stats-grid">${rows.join('')}</div></div>`;
    }

    _statRow(label, value) {
        return `<div class="rdp-stat-row"><span class="rdp-stat-label">${label}</span><span class="rdp-stat-value">${value}</span></div>`;
    }

    /** @param {string[]|undefined} ascensions */
    _buildAscensionsSection(ascensions) {
        if (!ascensions || ascensions.length === 0) return '';
        const items = ascensions.map(id => {
            const name = ASCENSION_NAMES[id] || this._formatId(id);
            const img = skillIconHtml({ iconImage: `assets/icons/skills/${id}.jpg`, name }, 28);
            return `<div class="rdp-asc-item">${img}<span class="asc-name">${name}</span></div>`;
        }).join('');
        return `<div class="rdp-section"><h4>Ascensions</h4><div class="rdp-asc-grid">${items}</div></div>`;
    }

    /** @param {object|undefined} skills */
    _buildSkillsSection(skills) {
        if (!skills?.ranks || Object.keys(skills.ranks).length === 0) return '';

        // Split by type based on equipped lists
        const actives = new Set(skills.equippedActives || []);
        const passive = new Set(skills.equippedPassives || []);
        const ultimate = skills.equippedUltimate;

        /** @param {string} id @param {number} rank */
        const skillItem = (id, rank) => {
            const name = this._formatId(id);
            const img = skillIconHtml({ iconImage: `assets/icons/skills/${id}.jpg`, name }, 28);
            return `<div class="rdp-skill-item">
                <div class="skill-icon">${img}</div>
                <div class="skill-info">
                    <span class="skill-name">${name}</span>
                    <span class="skill-rank">Rank ${rank}</span>
                </div>
            </div>`;
        };

        let html = '';

        if (ultimate) {
            const rank = skills.ranks[ultimate] ?? 1;
            html += `<div class="rdp-skills-group">
                <div class="rdp-skills-group-label">Ultimate</div>
                <div class="rdp-skills-grid">${skillItem(ultimate, rank)}</div>
            </div>`;
        }

        const activeIds = Object.keys(skills.ranks).filter(id => actives.has(id));
        if (activeIds.length) {
            html += `<div class="rdp-skills-group">
                <div class="rdp-skills-group-label">Active Skills</div>
                <div class="rdp-skills-grid">${activeIds.map(id => skillItem(id, skills.ranks[id])).join('')}</div>
            </div>`;
        }

        const passiveIds = Object.keys(skills.ranks).filter(id => passive.has(id));
        if (passiveIds.length) {
            html += `<div class="rdp-skills-group">
                <div class="rdp-skills-group-label">Passive Skills</div>
                <div class="rdp-skills-grid">${passiveIds.map(id => skillItem(id, skills.ranks[id])).join('')}</div>
            </div>`;
        }

        return `<div class="rdp-section"><h4>Skills</h4>${html}</div>`;
    }

    /* ── Helpers ────────────────────────────────────────────────────────── */

    /** Convert skill/ascension ID to readable name */
    _formatId(id) {
        return id
            .replace(/^(gunner|techno|technomancer|asc)_/, '')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    }

    /** @param {string} str */
    _esc(str) {
        const el = document.createElement('span');
        el.textContent = str;
        return el.innerHTML;
    }
}

customElements.define('leaderboard-screen', LeaderboardScreen);
export { LeaderboardScreen };
