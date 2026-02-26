/**
 * @fileoverview <hud-performance> — FPS / frame-time / avg performance stats overlay.
 * Only visible when ?stats=true.
 *
 * Internal IDs for HUDManager: performanceStats, fpsValue, frameTimeValue, avgFpsValue, optimizedValue
 */

import { BaseComponent } from '../BaseComponent.js';
import { createSheet } from '../shared-styles.js';

const styles = createSheet(/* css */`
  :host { display: contents; }

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

  /* Responsive — Mobile */
  @media (max-width: 480px) {
    .performance-stats {
      transform: scale(0.75);
      transform-origin: bottom left;
    }
    .perf-stat-item { min-width: 70px; }
    .perf-label, .perf-value { font-size: 6px; }
  }
`);

class HudPerformance extends BaseComponent {
    connectedCallback() {
        this._render(/* html */`
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
        `, styles);
    }
}

customElements.define('hud-performance', HudPerformance);
export { HudPerformance };
