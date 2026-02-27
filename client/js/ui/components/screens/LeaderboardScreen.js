/**
 * @fileoverview <leaderboard-screen> — redesigned leaderboard overlay with
 * difficulty tabs, stat tooltips, animated entrance/exit, and responsive layout.
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

/* ── Styles ───────────────────────────────────────────────────────────────── */
const styles = createSheet(/* css */ `
  :host { display: contents; }

  /* ── Container card ───────────────────────────────────────────────────── */
  .lb-container {
    position: relative;
    width: min(720px, 92vw);
    max-height: 80vh;
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

  /* Subtle scan-line on the card */
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

  /* ── Table wrapper ────────────────────────────────────────────────────── */
  .lb-table-wrap {
    overflow-y: auto;
    flex: 1;
    border: 1px solid rgba(0, 255, 255, 0.15);
    border-radius: var(--radius-md);
    background: rgba(0, 0, 0, 0.3);
    min-height: 200px;
  }
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
  tr:hover td {
    background: rgba(0, 255, 255, 0.04);
  }

  /* Row entrance animation */
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
  .rank-1 {
    color: #ffd700;
    text-shadow: 0 0 8px #ffd700, 0 0 16px rgba(255, 215, 0, 0.4);
    font-size: 13px;
  }
  .rank-2 {
    color: #c0c0c0;
    text-shadow: 0 0 6px #c0c0c0;
  }
  .rank-3 {
    color: #cd7f32;
    text-shadow: 0 0 6px #cd7f32;
  }

  /* Rank badge for top 3 */
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
  .rank-1 .rank-badge {
    background: rgba(255, 215, 0, 0.15);
    border: 1px solid rgba(255, 215, 0, 0.5);
  }
  .rank-2 .rank-badge {
    background: rgba(192, 192, 192, 0.12);
    border: 1px solid rgba(192, 192, 192, 0.4);
  }
  .rank-3 .rank-badge {
    background: rgba(205, 127, 50, 0.12);
    border: 1px solid rgba(205, 127, 50, 0.4);
  }

  .name-cell {
    font-weight: 600;
    color: #eee;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .score-cell {
    font-family: var(--font-pixel);
    font-size: 12px;
    color: var(--color-primary-neon);
    text-shadow: 0 0 4px var(--color-primary-neon);
  }
  .wave-cell {
    font-family: var(--font-pixel);
    font-size: 12px;
  }
  .victory-badge {
    color: #ffd700;
    font-size: 11px;
    margin-left: 4px;
    filter: drop-shadow(0 0 4px #ffd700);
  }

  /* ── Stats icon ───────────────────────────────────────────────────────── */
  .stats-cell {
    position: relative;
    cursor: pointer;
    text-align: center;
  }
  .stats-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: 1px solid rgba(0, 255, 255, 0.2);
    border-radius: 6px;
    font-size: 10px;
    font-weight: bold;
    color: var(--color-primary-neon);
    transition: all 0.2s;
    background: rgba(0, 255, 255, 0.04);
  }
  .stats-icon:hover {
    border-color: var(--color-primary-neon);
    background: rgba(0, 255, 255, 0.15);
    box-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
    transform: scale(1.1);
  }

  /* ── Tooltip ──────────────────────────────────────────────────────────── */
  .lb-tooltip {
    display: none;
    position: fixed;
    z-index: 1000;
    width: 280px;
    padding: 14px;
    background: rgba(5, 1, 10, 0.97);
    border: 1px solid rgba(0, 255, 255, 0.5);
    border-radius: var(--radius-md);
    box-shadow:
      0 0 20px rgba(0, 255, 255, 0.2),
      0 4px 20px rgba(0, 0, 0, 0.8),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
    font-size: 12px;
    color: #ccc;
    pointer-events: none;
    backdrop-filter: blur(8px);
  }
  .lb-tooltip.visible {
    display: block;
    animation: tooltipIn 0.15s ease-out;
  }
  @keyframes tooltipIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .lb-tooltip h4 {
    margin: 0 0 8px;
    font-family: var(--font-pixel);
    font-size: 11px;
    color: var(--color-primary-neon);
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .lb-tooltip .section {
    margin-bottom: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .lb-tooltip .section:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
  .lb-tooltip .stat-row {
    display: flex;
    justify-content: space-between;
    padding: 2px 0;
  }
  .lb-tooltip .stat-label { color: #777; font-size: 11px; }
  .lb-tooltip .stat-value { color: var(--color-primary-neon); font-family: var(--font-pixel); font-size: 11px; }
  .lb-tooltip .asc-tag {
    display: inline-block;
    padding: 3px 8px;
    margin: 2px;
    font-size: 10px;
    border: 1px solid rgba(255, 45, 236, 0.3);
    border-radius: 4px;
    background: rgba(255, 45, 236, 0.1);
    color: var(--color-secondary-neon);
  }
  .lb-tooltip .skill-tag {
    display: inline-block;
    padding: 3px 8px;
    margin: 2px;
    font-size: 10px;
    border: 1px solid rgba(0, 255, 255, 0.2);
    border-radius: 4px;
    background: rgba(0, 255, 255, 0.06);
    color: #aaa;
  }

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
  .lb-loading-spinner {
    width: 32px;
    height: 32px;
    color: var(--color-primary-neon);
    opacity: 0.7;
  }
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
  .lb-empty-icon {
    font-size: 28px;
    opacity: 0.4;
  }
  .lb-error {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--color-accent-red);
    font-size: 13px;
  }

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
  }
  .lb-user-rank strong {
    color: var(--color-primary-neon);
    font-family: var(--font-pixel);
    text-shadow: 0 0 4px var(--color-primary-neon);
  }

  /* ── Responsive ───────────────────────────────────────────────────────── */
  @media (max-width: 600px) {
    .lb-container {
      width: 96vw;
      padding: var(--spacing-md) var(--spacing-md);
      border-radius: var(--radius-lg);
    }
    .lb-heading { font-size: 16px; letter-spacing: 2px; }
    .lb-tab { padding: 6px 14px !important; font-size: 10px; }
    th { padding: 8px 8px; font-size: 9px; }
    td { padding: 8px 8px; font-size: 12px; }
    .name-cell { max-width: 100px; }
    .lb-tooltip { width: 240px; }
  }

  /* ── neonFlicker keyframe ─────────────────────────────────────────────── */
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
                    <div class="lb-table-wrap" id="tableWrap">
                        <div class="lb-loading">
                            <span class="lb-loading-spinner">${SPINNER_SVG}</span>
                            Loading…
                        </div>
                    </div>
                    <div class="lb-user-rank" id="userRank" style="display: none;"></div>
                </div>
                <div class="lb-tooltip" id="tooltip"></div>
            </div>
        `, overlayStyles, styles);

        // Tab switching
        this._$('#tabs').addEventListener('click', (e) => {
            const tab = /** @type {HTMLElement} */ (e.target).closest('.lb-tab');
            if (!tab) return;
            this.loadLeaderboard(/** @type {HTMLElement} */ (tab).dataset.diff);
        });

        // Close
        this._$('.close-btn').addEventListener('click', () => {
            this.hide();
            this._emit('leaderboard-close');
        });
    }

    /* ── Animated show / hide ───────────────────────────────────────────── */
    show() {
        super.show();
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

        // Update tabs
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

            // Top 3 get a badge, rest get plain number
            const rankContent = rank <= 3
                ? `<span class="rank-badge">${rank}</span>`
                : `#${rank}`;

            return `<tr>
                <td class="rank-cell${rankClass}">${rankContent}</td>
                <td class="name-cell">${this._esc(entry.display_name)}</td>
                <td class="score-cell">${entry.score.toLocaleString()}</td>
                <td class="wave-cell">W${entry.wave}${victoryBadge}</td>
                <td class="stats-cell" data-idx="${i}">
                    <span class="stats-icon">i</span>
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

        // Hover tooltips
        const tooltip = this._$('#tooltip');
        wrap.addEventListener('mouseenter', (e) => {
            const cell = /** @type {HTMLElement} */ (e.target).closest('.stats-cell');
            if (!cell) return;
            const idx = parseInt(/** @type {HTMLElement} */ (cell).dataset.idx);
            const entry = data.entries[idx];
            if (!entry) return;
            this._showTooltip(tooltip, entry, cell);
        }, true);

        wrap.addEventListener('mouseleave', (e) => {
            const cell = /** @type {HTMLElement} */ (e.target).closest('.stats-cell');
            if (cell || /** @type {HTMLElement} */ (e.target).closest('.stats-icon')) {
                tooltip.classList.remove('visible');
            }
        }, true);

        // User rank
        const rankEl = this._$('#userRank');
        if (data.userRank != null) {
            rankEl.innerHTML = `Your best rank: <strong>#${data.userRank}</strong> on ${this._currentDifficulty}`;
            rankEl.style.display = 'flex';
        }
    }

    _showTooltip(tooltip, entry, anchor) {
        const rd = entry.run_details || {};
        let html = '';

        // Attributes
        if (rd.attributes) {
            const attrs = rd.attributes;
            html += `<div class="section">
                <h4>Attributes</h4>
                <div class="stat-row"><span class="stat-label">STR</span><span class="stat-value">${attrs.STR || 0}</span></div>
                <div class="stat-row"><span class="stat-label">DEX</span><span class="stat-value">${attrs.DEX || 0}</span></div>
                <div class="stat-row"><span class="stat-label">VIT</span><span class="stat-value">${attrs.VIT || 0}</span></div>
                <div class="stat-row"><span class="stat-label">INT</span><span class="stat-value">${attrs.INT || 0}</span></div>
                <div class="stat-row"><span class="stat-label">LUCK</span><span class="stat-value">${attrs.LUCK || 0}</span></div>
            </div>`;
        }

        // Combat stats
        if (rd.stats) {
            const s = rd.stats;
            html += `<div class="section"><h4>Combat Stats</h4>`;
            if (s.damageMod != null) html += `<div class="stat-row"><span class="stat-label">Damage</span><span class="stat-value">${s.damageMod.toFixed(1)}x</span></div>`;
            if (s.fireRateMod != null) html += `<div class="stat-row"><span class="stat-label">Fire Rate</span><span class="stat-value">${s.fireRateMod.toFixed(1)}x</span></div>`;
            if (s.maxHp != null) html += `<div class="stat-row"><span class="stat-label">Max HP</span><span class="stat-value">${s.maxHp}</span></div>`;
            if (s.maxShieldHp) html += `<div class="stat-row"><span class="stat-label">Shield</span><span class="stat-value">${s.maxShieldHp}</span></div>`;
            if (s.piercingLevel) html += `<div class="stat-row"><span class="stat-label">Pierce</span><span class="stat-value">${s.piercingLevel}</span></div>`;
            const flags = [];
            if (s.hasTripleShot) flags.push('Triple Shot');
            if (s.hasHomingShots) flags.push('Homing');
            if (s.explosiveShots) flags.push('Explosive');
            if (flags.length) html += `<div class="stat-row"><span class="stat-label">Abilities</span><span class="stat-value">${flags.join(', ')}</span></div>`;
            html += `</div>`;
        }

        // Ascensions
        if (rd.ascensions && rd.ascensions.length > 0) {
            const tags = rd.ascensions.map(id => `<span class="asc-tag">${ASCENSION_NAMES[id] || id}</span>`).join('');
            html += `<div class="section"><h4>Ascensions</h4>${tags}</div>`;
        }

        // Skills
        if (rd.skills?.ranks && Object.keys(rd.skills.ranks).length > 0) {
            const tags = Object.entries(rd.skills.ranks)
                .map(([id, lvl]) => `<span class="skill-tag">${this._formatSkillName(id)} ${lvl}</span>`)
                .join('');
            html += `<div class="section"><h4>Skills</h4>${tags}</div>`;
        }

        if (!html) {
            html = '<div class="lb-empty" style="padding: 8px;">No details available</div>';
        }

        tooltip.innerHTML = html;
        tooltip.classList.add('visible');

        // Position near the anchor
        const rect = anchor.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        let left = rect.left - tooltipRect.width - 8;
        let top = rect.top;

        // Keep on screen
        if (left < 8) left = rect.right + 8;
        if (top + tooltipRect.height > window.innerHeight - 8) {
            top = window.innerHeight - tooltipRect.height - 8;
        }

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }

    /** @param {string} id e.g. "gunner_sharp_rounds" -> "Sharp Rounds" */
    _formatSkillName(id) {
        return id.replace(/^(gunner|technomancer|ascension)_/, '')
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
