/**
 * @fileoverview <leaderboard-screen> — leaderboard overlay with difficulty tabs and stat tooltips.
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

const styles = createSheet(/* css */ `
  :host { display: contents; }
  .lb-container {
    width: min(700px, 92vw);
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }
  .lb-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-md);
  }
  .lb-tabs {
    display: flex;
    gap: 4px;
    justify-content: center;
    margin-bottom: var(--spacing-md);
  }
  .lb-tab {
    padding: 8px 20px;
    font-size: 13px;
    font-family: var(--font-pixel);
    border: 1px solid rgba(0, 255, 255, 0.3);
    border-radius: var(--radius-sm);
    background: rgba(0, 0, 0, 0.4);
    color: #aaa;
    cursor: pointer;
    transition: all 0.2s;
    text-transform: uppercase;
  }
  .lb-tab:hover {
    border-color: var(--color-secondary-neon);
    color: #fff;
  }
  .lb-tab.active {
    border-color: var(--color-primary-neon);
    background: rgba(0, 255, 255, 0.12);
    color: var(--color-primary-neon);
    box-shadow: 0 0 10px rgba(0, 255, 255, 0.2);
  }
  .lb-table-wrap {
    overflow-y: auto;
    flex: 1;
    border: 1px solid rgba(0, 255, 255, 0.15);
    border-radius: var(--radius-md);
    background: rgba(0, 0, 0, 0.3);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th {
    position: sticky;
    top: 0;
    background: rgba(5, 1, 10, 0.95);
    padding: 10px 12px;
    text-align: left;
    font-family: var(--font-pixel);
    font-size: 11px;
    color: var(--color-primary-neon);
    text-transform: uppercase;
    letter-spacing: 1px;
    border-bottom: 1px solid rgba(0, 255, 255, 0.3);
  }
  td {
    padding: 8px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    color: #ccc;
  }
  tr:hover td {
    background: rgba(0, 255, 255, 0.04);
  }
  .rank-cell {
    font-family: var(--font-pixel);
    font-size: 12px;
    color: var(--color-primary-neon);
    width: 50px;
    text-align: center;
  }
  .rank-1 { color: #ffd700; text-shadow: 0 0 8px #ffd700; }
  .rank-2 { color: #c0c0c0; text-shadow: 0 0 6px #c0c0c0; }
  .rank-3 { color: #cd7f32; text-shadow: 0 0 6px #cd7f32; }
  .name-cell {
    font-weight: 600;
    color: #fff;
    max-width: 150px;
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
    font-size: 10px;
    margin-left: 4px;
  }
  .stats-cell {
    position: relative;
    cursor: pointer;
    text-align: center;
  }
  .stats-icon {
    display: inline-block;
    width: 20px;
    height: 20px;
    line-height: 20px;
    text-align: center;
    border: 1px solid rgba(0, 255, 255, 0.3);
    border-radius: 4px;
    font-size: 10px;
    color: var(--color-primary-neon);
    transition: all 0.2s;
  }
  .stats-icon:hover {
    border-color: var(--color-primary-neon);
    background: rgba(0, 255, 255, 0.15);
    box-shadow: 0 0 8px rgba(0, 255, 255, 0.3);
  }

  /* Tooltip */
  .lb-tooltip {
    display: none;
    position: fixed;
    z-index: 1000;
    width: 280px;
    padding: 12px;
    background: rgba(5, 1, 10, 0.96);
    border: 1px solid rgba(0, 255, 255, 0.5);
    border-radius: var(--radius-md);
    box-shadow: 0 0 20px rgba(0, 255, 255, 0.2), 0 4px 16px rgba(0, 0, 0, 0.8);
    font-size: 12px;
    color: #ccc;
    pointer-events: none;
  }
  .lb-tooltip.visible { display: block; }
  .lb-tooltip h4 {
    margin: 0 0 6px;
    font-family: var(--font-pixel);
    font-size: 11px;
    color: var(--color-primary-neon);
    text-transform: uppercase;
  }
  .lb-tooltip .section {
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
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
  .lb-tooltip .stat-label { color: #888; }
  .lb-tooltip .stat-value { color: var(--color-primary-neon); }
  .lb-tooltip .asc-tag {
    display: inline-block;
    padding: 2px 6px;
    margin: 2px;
    font-size: 10px;
    border: 1px solid rgba(255, 45, 236, 0.3);
    border-radius: 3px;
    background: rgba(255, 45, 236, 0.1);
    color: var(--color-secondary-neon);
  }
  .lb-tooltip .skill-tag {
    display: inline-block;
    padding: 2px 6px;
    margin: 2px;
    font-size: 10px;
    border: 1px solid rgba(0, 255, 255, 0.2);
    border-radius: 3px;
    background: rgba(0, 255, 255, 0.06);
    color: #aaa;
  }

  .lb-loading {
    text-align: center;
    padding: var(--spacing-xl);
    color: #888;
  }
  .lb-empty {
    text-align: center;
    padding: var(--spacing-xl);
    color: #666;
    font-style: italic;
  }
  .lb-user-rank {
    margin-top: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid rgba(0, 255, 255, 0.2);
    border-radius: var(--radius-sm);
    background: rgba(0, 255, 255, 0.06);
    font-size: 13px;
    text-align: center;
    color: #aaa;
  }
  .lb-user-rank strong {
    color: var(--color-primary-neon);
    font-family: var(--font-pixel);
  }
  .close-btn {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 32px;
    height: 32px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .close-btn:hover {
    border-color: var(--color-primary-neon);
  }
`);

class LeaderboardScreen extends BaseComponent {
    connectedCallback() {
        this._currentDifficulty = 'normal';
        this._data = null;

        this._render(/* html */ `
            <div class="overlay">
                <button class="close-btn" id="closeBtn">&times;</button>
                <div class="lb-container">
                    <h2>LEADERBOARD</h2>
                    <div class="lb-tabs" id="tabs">
                        <button class="lb-tab" data-diff="easy">Easy</button>
                        <button class="lb-tab active" data-diff="normal">Normal</button>
                        <button class="lb-tab" data-diff="hard">Hard</button>
                    </div>
                    <div class="lb-table-wrap" id="tableWrap">
                        <div class="lb-loading" id="loading">Loading...</div>
                    </div>
                    <div class="lb-user-rank" id="userRank" style="display: none;"></div>
                </div>
                <div class="lb-tooltip" id="tooltip"></div>
            </div>
        `, overlayStyles, styles);

        // Tab switching
        this._$('#tabs').addEventListener('click', (e) => {
            const tab = e.target.closest('.lb-tab');
            if (!tab) return;
            this.loadLeaderboard(tab.dataset.diff);
        });

        this._$('#closeBtn').addEventListener('click', () => {
            this.hide();
            this._emit('leaderboard-close');
        });
    }

    show() {
        super.show();
        this.loadLeaderboard(this._currentDifficulty);
    }

    /** @param {string} [difficulty] */
    async loadLeaderboard(difficulty = 'normal') {
        this._currentDifficulty = difficulty;

        // Update tabs
        this._$$('.lb-tab').forEach(t =>
            t.classList.toggle('active', t.dataset.diff === difficulty)
        );

        const wrap = this._$('#tableWrap');
        wrap.innerHTML = '<div class="lb-loading">Loading...</div>';
        this._$('#userRank').style.display = 'none';

        try {
            const data = await apiFetch(`/api/leaderboard?difficulty=${difficulty}&limit=50`);
            this._data = data;
            this._renderTable(data);
        } catch (err) {
            wrap.innerHTML = `<div class="lb-empty">Could not load leaderboard</div>`;
        }
    }

    /** @param {{ entries: any[], total: number, userRank: number|null }} data */
    _renderTable(data) {
        const wrap = this._$('#tableWrap');

        if (!data.entries || data.entries.length === 0) {
            wrap.innerHTML = '<div class="lb-empty">No entries yet. Be the first!</div>';
            return;
        }

        const rows = data.entries.map((entry, i) => {
            const rank = entry.rank || i + 1;
            const rankClass = rank <= 3 ? ` rank-${rank}` : '';
            const victoryBadge = entry.is_victory ? '<span class="victory-badge">&#9733;</span>' : '';

            return `<tr>
                <td class="rank-cell${rankClass}">#${rank}</td>
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
            const cell = e.target.closest('.stats-cell');
            if (!cell) return;
            const idx = parseInt(cell.dataset.idx);
            const entry = data.entries[idx];
            if (!entry) return;
            this._showTooltip(tooltip, entry, cell);
        }, true);

        wrap.addEventListener('mouseleave', (e) => {
            const cell = e.target.closest('.stats-cell');
            if (cell || e.target.closest('.stats-icon')) {
                tooltip.classList.remove('visible');
            }
        }, true);

        // User rank
        const rankEl = this._$('#userRank');
        if (data.userRank != null) {
            rankEl.innerHTML = `Your best rank: <strong>#${data.userRank}</strong> on ${this._currentDifficulty}`;
            rankEl.style.display = 'block';
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
