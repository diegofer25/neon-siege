/**
 * @fileoverview <game-hud> — Shadow-DOM component wrapping the entire in-game
 * heads-up display: health / defence bars, wave counter, score, XP, combo,
 * skill / passive / ascension slots, stats, settings button, challenges,
 * and performance overlay.
 *
 * HUDManager accesses internal elements via the open shadowRoot to cache refs
 * once, so per-frame writes stay zero-overhead after initialization.
 *
 * Events emitted:
 *   • 'settings-click' — user clicked the settings gear button
 */

import { createSheet } from './shared-styles.js';
import { BaseComponent } from './BaseComponent.js';

// ---------------------------------------------------------------------------
// Stylesheet (hud + health + stats + skill-slots + passive-slots +
//             ascension badges + responsive overrides)
// ---------------------------------------------------------------------------
const hudSheet = createSheet(/* css */`
/* ---- Host (replaces old #hud) ---- */
:host {
  position: absolute;
  top: var(--spacing-lg);
  left: var(--spacing-lg);
  right: var(--spacing-lg);
  bottom: var(--spacing-lg);
  pointer-events: none;
  z-index: var(--z-hud);
  display: block;
}

/* ---- Base HUD element ---- */
.hud-element {
  display: inline-block;
  margin-right: var(--spacing-xl);
  pointer-events: auto;
}

/* ============================================================
   WAVE COUNTER
   ============================================================ */
#waveCounter {
  position: absolute;
  top: 2px;
  left: 50%;
  transform: translateX(-50%);
  padding: var(--spacing-sm) var(--spacing-lg);
  border: 1px solid rgba(0, 255, 255, 0.45);
  border-radius: var(--radius-md);
  background: rgba(0, 0, 0, 0.55);
  box-shadow:
    0 0 12px rgba(0, 255, 255, 0.25),
    inset 0 0 10px rgba(0, 255, 255, 0.08);
}

#wave {
  font-family: var(--font-pixel);
  color: var(--color-primary-neon);
  text-shadow: 0 0 5px var(--color-primary-neon), 0 0 10px var(--color-primary-neon);
  font-size: 14px;
  line-height: 1;
}

/* ============================================================
   SETTINGS BUTTON
   ============================================================ */
#settingsButton {
  position: absolute;
  top: 0;
  right: 0;
}

#settingsBtn {
  background: rgba(20, 20, 28, 0.88);
  border: 2px solid var(--color-secondary-neon);
  color: var(--color-secondary-neon);
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  font-size: 16px;
  border-radius: var(--radius-md);
  transition: var(--transition-normal);
  box-shadow:
    0 0 10px rgba(255, 45, 236, 0.4),
    inset 0 0 8px rgba(255, 45, 236, 0.12);
}

#settingsBtn:hover {
  background: #333;
  box-shadow: 0 0 15px var(--color-secondary-neon);
  transform: translateY(-2px);
}

/* ============================================================
   HEALTH & DEFENSE BARS
   ============================================================ */
#healthBar {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 6px var(--spacing-sm);
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(0, 255, 255, 0.26);
  border-radius: var(--radius-md);
  box-shadow: 0 0 10px rgba(0, 255, 255, 0.16);
}

#defenseBar {
  position: absolute;
  top: 46px;
  left: 0;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 6px var(--spacing-sm);
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 45, 236, 0.26);
  border-radius: var(--radius-md);
  box-shadow: 0 0 10px rgba(255, 45, 236, 0.16);
}

.healthbar, .defensebar {
  position: relative;
  width: clamp(140px, 15vw, 200px);
  height: 16px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 99px;
  overflow: hidden;
  box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.8);
}

.healthfill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  background: linear-gradient(90deg, var(--color-accent-green) 0%, #00e67a 50%, #39ff8e 100%);
  border-radius: 99px;
  transition: width 0.2s ease;
  box-shadow: 0 0 8px var(--color-accent-green);
}

.defensefill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  background: linear-gradient(90deg, var(--color-secondary-neon) 0%, #ff5def 50%, #ff80f4 100%);
  border-radius: 99px;
  transition: width 0.2s ease;
  box-shadow: 0 0 8px var(--color-secondary-neon);
}

#healthText, #defenseText {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: #fff;
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.7);
  white-space: nowrap;
}

/* ============================================================
   COIN DISPLAY
   ============================================================ */
.coin-display {
  position: absolute;
  top: 52px;
  left: 120px;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  background: var(--bg-glass);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  border: 2px solid var(--color-accent-yellow);
  box-shadow:
    0 0 12px rgba(255, 255, 0, 0.25),
    inset 0 0 10px rgba(255, 255, 0, 0.08);
  transition: top var(--transition-normal);
}

.coin-display.with-shield {
  top: 100px;
  left: 120px;
}

.coin-icon {
  color: var(--color-accent-yellow);
  font-size: 14px;
  filter: drop-shadow(0 0 3px var(--color-accent-yellow));
}

.coin-amount {
  font-family: var(--font-pixel);
  color: var(--color-accent-yellow);
  text-shadow: 0 0 3px var(--color-accent-yellow);
  font-size: 11px;
}

/* ============================================================
   SCORE DISPLAY
   ============================================================ */
.score-display {
  position: absolute;
  top: 0;
  right: 70px;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 45, 236, 0.35);
  border-radius: var(--radius-md);
  box-shadow: 0 0 10px rgba(255, 45, 236, 0.16);
  pointer-events: none;
}

.score-value {
  font-family: var(--font-pixel);
  color: #fff;
  text-shadow: 0 0 5px #fff;
  font-size: 12px;
  line-height: 1;
}

.score-multiplier {
  font-family: var(--font-pixel);
  color: var(--color-accent-yellow);
  text-shadow: 0 0 8px var(--color-accent-yellow);
  font-size: 10px;
  animation: pulseGlow 0.6s ease-in-out infinite alternate;
}

/* ============================================================
   XP BAR
   ============================================================ */
.xp-bar {
  position: absolute;
  top: 38px;
  left: 50%;
  transform: translateX(-50%);
  width: 200px;
  height: 10px;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(143, 0, 255, 0.4);
  border-radius: 5px;
  overflow: hidden;
  pointer-events: none;
}

.xp-fill {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, var(--color-tertiary-neon), var(--color-secondary-neon));
  border-radius: 5px;
  transition: width 0.3s ease;
  box-shadow: 0 0 8px rgba(143, 0, 255, 0.5);
}

.xp-level {
  position: absolute;
  right: -40px;
  top: 50%;
  transform: translateY(-50%);
  font-family: var(--font-pixel);
  font-size: 8px;
  color: var(--color-secondary-neon);
  text-shadow: 0 0 4px var(--color-secondary-neon);
  white-space: nowrap;
}

/* ============================================================
   COMBO COUNTER
   ============================================================ */
.combo-counter {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: var(--spacing-sm) var(--spacing-lg);
  background: rgba(0, 0, 0, 0.7);
  border: 2px solid #fff;
  border-radius: var(--radius-lg);
  pointer-events: none;
  transition: border-color 0.2s;
}

.combo-label {
  font-family: var(--font-pixel);
  font-size: 10px;
  color: #fff;
  text-shadow: 0 0 8px currentColor;
  letter-spacing: 1px;
  transition: color 0.2s;
}

.combo-count {
  font-family: var(--font-pixel);
  font-size: 20px;
  color: #fff;
  text-shadow: 0 0 12px currentColor;
  line-height: 1;
  transition: color 0.2s;
}

.combo-timer-bar {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  overflow: hidden;
}

.combo-timer-fill {
  height: 100%;
  width: 100%;
  background: #fff;
  border-radius: 2px;
  transition: width 0.1s linear, background 0.2s;
  box-shadow: 0 0 6px currentColor;
}

/* ============================================================
   CHALLENGE DISPLAY
   ============================================================ */
.challenge-display {
  position: absolute;
  top: 56px;
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  pointer-events: none;
}

.challenge-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: 3px var(--spacing-sm);
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-sm);
  font-family: var(--font-pixel);
  font-size: 7px;
  color: #aaa;
}

.challenge-item.completed {
  border-color: var(--color-accent-green);
  color: var(--color-accent-green);
}

.challenge-icon {
  font-size: 10px;
}

.challenge-progress {
  font-family: var(--font-pixel);
}

/* ============================================================
   STATS DISPLAY
   ============================================================ */
#statsDisplay {
  position: absolute;
  bottom: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.stat-item {
  display: flex;
  align-items: center;
  margin-bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  padding: 7px 10px;
  border-radius: var(--radius-md);
  border: 1px solid rgba(0, 255, 255, 0.28);
  box-shadow:
    0 0 8px rgba(0, 255, 255, 0.2),
    inset 0 0 8px rgba(0, 255, 255, 0.08);
  min-width: 150px;
  justify-content: space-between;
}

.stat-icon {
  font-size: 12px;
  margin-right: var(--spacing-sm);
  filter: drop-shadow(0 0 3px currentColor);
  flex-shrink: 0;
}

.stat-label {
  font-family: var(--font-pixel);
  color: var(--color-primary-neon);
  text-shadow: 0 0 3px var(--color-primary-neon);
  font-size: 8px;
  margin-right: var(--spacing-xs);
  flex-shrink: 0;
}

.stat-value {
  font-family: var(--font-pixel);
  color: #fff;
  text-shadow: 0 0 3px #fff;
  font-size: 8px;
  text-align: right;
  flex-grow: 1;
  transition: color 0.3s, text-shadow 0.3s, transform 0.3s;
}

/* ============================================================
   PERFORMANCE STATS
   ============================================================ */
.performance-stats {
  position: absolute;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 10;
  pointer-events: auto;
}

.perf-stat-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  background: rgba(0, 0, 0, 0.5);
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(0, 255, 255, 0.2);
  min-width: 90px;
}

.perf-label {
  font-family: var(--font-pixel);
  font-size: 7px;
  color: var(--color-primary-neon);
  text-shadow: 0 0 3px var(--color-primary-neon);
}

.perf-value {
  font-family: var(--font-pixel);
  font-size: 7px;
  color: #fff;
  text-shadow: 0 0 3px #fff;
}

.perf-value.warning {
  color: #ff0;
  text-shadow: 0 0 3px #ff0;
}

.perf-value.critical {
  color: #f00;
  text-shadow: 0 0 3px #f00;
}

/* ============================================================
   SKILL SLOTS (QERT HUD bar)
   ============================================================ */
.skill-slots {
  display: flex;
  gap: 6px;
  position: absolute;
  bottom: 76px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  pointer-events: auto;
}

.skill-slot {
  position: relative;
  width: 52px;
  height: 52px;
  border: 2px solid rgba(0, 255, 255, 0.5);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: default;
  user-select: none;
}

.skill-slot.ultimate {
  border-color: rgba(255, 45, 236, 0.6);
}

.skill-slot.on-cooldown {
  opacity: 0.6;
}

.skill-key {
  position: absolute;
  top: 2px;
  left: 4px;
  font-family: 'Audiowide', sans-serif;
  font-size: 10px;
  color: rgba(0, 255, 255, 0.8);
  text-shadow: 0 0 4px rgba(0, 255, 255, 0.4);
  z-index: 2;
}

.skill-cd-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 0%;
  background: rgba(0, 255, 255, 0.15);
  transition: height 0.1s linear;
  z-index: 1;
}

.skill-slot-name {
  font-family: 'Press Start 2P', monospace;
  font-size: 7px;
  color: #fff;
  text-align: center;
  z-index: 2;
  max-width: 48px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
}

.skill-slot-name .skill-icon-img {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  object-fit: cover;
  image-rendering: auto;
}

/* ============================================================
   PASSIVE SLOTS (dynamically populated)
   ============================================================ */
.passive-slots {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  position: absolute;
  top: 90px;
  left: 0;
  max-width: 220px;
  z-index: 10;
  pointer-events: auto;
  transition: top var(--transition-normal);
}

.passive-slots.with-shield {
  top: 138px;
}

.passive-slot {
  width: 40px;
  height: 26px;
  border: 1px solid rgba(0, 255, 255, 0.35);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.58);
  display: flex;
  align-items: center;
  justify-content: center;
}

.passive-slot span {
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  color: rgba(255, 255, 255, 0.75);
  display: flex;
  align-items: center;
  gap: 2px;
}

.passive-slot .skill-icon-img {
  width: 18px;
  height: 18px;
  border-radius: 3px;
  object-fit: cover;
  image-rendering: auto;
}

.passive-slot.filled {
  border-color: rgba(255, 45, 236, 0.55);
  box-shadow: 0 0 10px rgba(255, 45, 236, 0.3);
}

/* ============================================================
   ASCENSION BADGE SLOTS
   ============================================================ */
.ascension-slots {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  justify-content: center;
  position: absolute;
  bottom: 190px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  pointer-events: auto;
  max-width: 320px;
}

.ascension-badge {
  width: 30px;
  height: 30px;
  border: 2px solid rgba(255, 215, 0, 0.65);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  cursor: default;
  box-shadow: 0 0 8px rgba(255, 215, 0, 0.3), inset 0 0 6px rgba(255, 215, 0, 0.08);
  transition: transform 0.15s, box-shadow 0.15s;
  user-select: none;
}

.ascension-badge .skill-icon-img {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  object-fit: cover;
  image-rendering: auto;
}

.ascension-badge:hover {
  transform: scale(1.18);
  box-shadow: 0 0 16px rgba(255, 215, 0, 0.65);
}

/* ============================================================
   KEYFRAMES
   ============================================================ */
@keyframes pulseGlow {
  from { opacity: 0.7; }
  to   { opacity: 1; }
}

/* ============================================================
   RESPONSIVE — Tablet (max-width: 768px)
   ============================================================ */
@media (max-width: 768px) {
  :host {
    top: 5px;
    left: 5px;
    right: 5px;
    bottom: 5px;
  }

  #waveCounter {
    top: 2px;
    left: 60%;
    transform: translateX(-50%);
    padding: 6px var(--spacing-sm);
  }

  #wave { font-size: 9px; }

  #healthBar,
  #defenseBar {
    padding: 5px 6px;
    gap: 6px;
  }

  #defenseBar { top: 42px; }

  .healthbar,
  .defensebar {
    width: clamp(120px, 33vw, 180px);
    height: 12px;
  }

  #healthText,
  #defenseText { font-size: 8px; }

  .coin-display {
    top: 42px;
    padding: 5px 7px;
  }

  .coin-display.with-shield { top: 78px; }
  .coin-icon { font-size: 10px; }
  .coin-amount { font-size: 8px; }

  .stat-item {
    margin-bottom: 2px;
    padding: 3px var(--spacing-md);
    min-width: 100px;
  }

  .stat-label, .stat-value { font-size: 7px; }
  .stat-icon { font-size: 10px; }

  .skill-slots { bottom: 68px; }
  .passive-slots { bottom: 124px; }
}

/* ============================================================
   RESPONSIVE — Mobile (max-width: 480px)
   ============================================================ */
@media (max-width: 480px) {
  .skill-slots { bottom: 64px; }
  .passive-slots { bottom: 116px; }

  #statsDisplay {
    transform: scale(0.85);
    transform-origin: bottom right;
  }

  #waveCounter {
    top: 2px;
    left: 62%;
    padding: 5px 7px;
  }

  #wave { font-size: 8px; }

  #settingsBtn {
    font-size: 13px;
    padding: 6px 9px;
  }

  #healthBar,
  #defenseBar {
    max-width: calc(100vw - 112px);
    padding: 4px 5px;
    gap: 5px;
  }

  #defenseBar { top: 39px; }

  .healthbar,
  .defensebar {
    width: clamp(104px, 35vw, 150px);
    height: 11px;
  }

  #healthText,
  #defenseText { font-size: 7px; }

  .coin-display {
    top: 40px;
    padding: 5px 7px;
  }

  .coin-display.with-shield { top: 74px; }
  .coin-icon { font-size: 10px; }
  .coin-amount { font-size: 8px; }

  .performance-stats {
    transform: scale(0.75);
    transform-origin: bottom left;
  }

  .perf-stat-item { min-width: 70px; }
  .perf-label, .perf-value { font-size: 6px; }

  .stat-item { min-width: 80px; }
  .stat-label, .stat-value { font-size: 6px; }
  .stat-icon { font-size: 8px; }
}

/* ============================================================
   RESPONSIVE — Landscape (max-width: 900px / landscape)
   ============================================================ */
@media (max-width: 900px) and (orientation: landscape) {
  :host {
    top: 4px;
    left: 4px;
    right: 4px;
    bottom: 4px;
  }

  #waveCounter {
    top: 2px;
    left: 50%;
    transform: translateX(-50%);
    padding: 6px 8px;
  }

  #wave { font-size: 10px; }

  #settingsBtn {
    font-size: 12px;
    padding: 4px 8px;
  }

  #healthBar,
  #defenseBar {
    padding: 4px 6px;
    gap: 5px;
  }

  #defenseBar { top: 34px; }

  .healthbar,
  .defensebar {
    width: clamp(120px, 18vw, 170px);
    height: 10px;
  }

  #healthText,
  #defenseText { font-size: 7px; }

  .coin-display {
    top: 36px;
    padding: 4px 8px;
  }

  .coin-display.with-shield { top: 68px; }
  .coin-icon { font-size: 10px; }
  .coin-amount { font-size: 10px; }

  #statsDisplay {
    transform: scale(0.9);
    transform-origin: bottom right;
  }
}
`);

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------
const TEMPLATE = /* html */`
<!-- Health Bar -->
<div id="healthBar" class="hud-element">
    <div class="healthbar">
        <div class="healthfill" id="healthFill"></div>
    </div>
    <span id="healthText">100/100</span>
</div>

<!-- Defense Bar -->
<div id="defenseBar" class="hud-element" style="display: none;">
    <div class="defensebar">
        <div class="defensefill" id="defenseFill"></div>
    </div>
    <span id="defenseText">0/0</span>
</div>

<!-- Skill Slots (QERT) -->
<div id="skillSlots" class="skill-slots">
    <div class="skill-slot" data-slot="0" data-key="Q" data-tooltip-type="active">
        <span class="skill-key">Q</span>
        <div class="skill-cd-fill" id="skillCd0"></div>
        <span class="skill-slot-name" id="skillName0">—</span>
    </div>
    <div class="skill-slot" data-slot="1" data-key="E" data-tooltip-type="active">
        <span class="skill-key">E</span>
        <div class="skill-cd-fill" id="skillCd1"></div>
        <span class="skill-slot-name" id="skillName1">—</span>
    </div>
    <div class="skill-slot" data-slot="2" data-key="R" data-tooltip-type="active">
        <span class="skill-key">R</span>
        <div class="skill-cd-fill" id="skillCd2"></div>
        <span class="skill-slot-name" id="skillName2">—</span>
    </div>
    <div class="skill-slot ultimate" data-slot="3" data-key="T" data-tooltip-type="active">
        <span class="skill-key">T</span>
        <div class="skill-cd-fill" id="skillCd3"></div>
        <span class="skill-slot-name" id="skillName3">🔒</span>
    </div>
</div>

<!-- Passive skill icons (dynamically populated) -->
<div id="passiveSlots" class="passive-slots"></div>

<!-- Ascension Modifier Badges -->
<div id="ascensionSlots" class="ascension-slots"></div>

<!-- Wave Counter -->
<div id="waveCounter" class="hud-element">
    <span id="wave">Wave: 1</span>
</div>

<!-- Settings Button -->
<div id="settingsButton" class="hud-element">
    <button id="settingsBtn" title="Settings">⚙️</button>
</div>

<!-- Stats Display -->
<div id="statsDisplay" class="hud-element">
    <div class="stat-item">
        <span class="stat-icon">⚔️</span>
        <span class="stat-label">ATK:</span>
        <span id="attackValue" class="stat-value">10</span>
    </div>
    <div class="stat-item">
        <span class="stat-icon">⚡</span>
        <span class="stat-label">SPD:</span>
        <span id="speedValue" class="stat-value">1.0x</span>
    </div>
    <div class="stat-item">
        <span class="stat-icon">❤️</span>
        <span class="stat-label">HP REG:</span>
        <span id="hpsValue" class="stat-value">0</span>
    </div>
    <div class="stat-item">
        <span class="stat-icon">💚</span>
        <span class="stat-label">DEF REG:</span>
        <span id="regenValue" class="stat-value">0</span>
    </div>
</div>

<!-- Score Display -->
<div id="scoreDisplay" class="score-display">
    <span id="scoreValue" class="score-value">0</span>
    <span id="scoreMultiplier" class="score-multiplier" style="display: none;">x1.0</span>
</div>

<!-- XP Bar -->
<div id="xpBar" class="xp-bar">
    <div id="xpFill" class="xp-fill"></div>
    <span id="xpLevel" class="xp-level">Lv.1</span>
</div>

<!-- Combo Counter -->
<div id="comboCounter" class="combo-counter" style="display: none;">
    <span id="comboLabel" class="combo-label">COMBO</span>
    <span id="comboCount" class="combo-count">0</span>
    <div class="combo-timer-bar">
        <div id="comboTimerFill" class="combo-timer-fill"></div>
    </div>
</div>

<!-- Challenges -->
<div id="challengeDisplay" class="challenge-display" style="display: none;"></div>

<!-- Performance Statistics (only shown with ?stats=true) -->
<div id="performanceStats" class="performance-stats" style="display: none;">
    <div class="perf-stat-item">
        <span class="perf-label">FPS:</span>
        <span id="fpsValue" class="perf-value">60</span>
    </div>
    <div class="perf-stat-item">
        <span class="perf-label">Frame:</span>
        <span id="frameTimeValue" class="perf-value">16ms</span>
    </div>
    <div class="perf-stat-item">
        <span class="perf-label">Avg:</span>
        <span id="avgFpsValue" class="perf-value">60</span>
    </div>
    <div class="perf-stat-item">
        <span class="perf-label">Optimized:</span>
        <span id="optimizedValue" class="perf-value">No</span>
    </div>
</div>
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
class GameHud extends BaseComponent {
    connectedCallback() {
        this._render(TEMPLATE, hudSheet);

        // Wire settings button → composed event
        this._$('#settingsBtn')?.addEventListener('click', () => {
            this._emit('settings-click');
        });
    }
}

customElements.define('game-hud', GameHud);
