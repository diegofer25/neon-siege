/**
 * @fileoverview <pause-screen> — simple pause overlay.
 */

import { BaseComponent } from './BaseComponent.js';
import { overlayStyles } from './shared-styles.js';

class PauseScreen extends BaseComponent {
    connectedCallback() {
        this._render(/* html */ `
            <div class="overlay">
                <h2>PAUSED</h2>
                <p>Press P to resume</p>
            </div>
        `, overlayStyles);
    }
}

customElements.define('pause-screen', PauseScreen);
export { PauseScreen };
