/**
 * @fileoverview Base class for all Neon Siege web components.
 *
 * Provides helpers shared by every custom element:
 *   - `_render(template, ...sheets)` — set shadow DOM HTML + adopted stylesheets
 *   - `_$(selector)` — scoped querySelector inside shadow root
 *   - `_$$(selector)` — scoped querySelectorAll
 *   - `show()` / `hide()` — toggle `.show` class on the root overlay div
 *   - `_emit(name, detail)` — dispatch a composed CustomEvent
 */

import { sharedStyles } from './shared-styles.js';

export class BaseComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    /**
     * Set shadow DOM content and styles.
     * @param {string} template   HTML string for shadowRoot
     * @param {...CSSStyleSheet} sheets  Additional stylesheets to adopt
     */
    _render(template, ...sheets) {
        this.shadowRoot.innerHTML = template;
        this.shadowRoot.adoptedStyleSheets = [sharedStyles, ...sheets];
    }

    /**
     * Scoped querySelector inside shadow root.
     * @param {string} selector
     * @returns {HTMLElement|null}
     */
    _$(selector) {
        return /** @type {HTMLElement|null} */ (this.shadowRoot.querySelector(selector));
    }

    /**
     * Scoped querySelectorAll inside shadow root.
     * @param {string} selector
     * @returns {NodeListOf<HTMLElement>}
     */
    _$$(selector) {
        return this.shadowRoot.querySelectorAll(selector);
    }

    /**
     * Show the overlay root (.overlay).
     */
    show() {
        const root = this._$('.overlay') || this.shadowRoot.firstElementChild;
        root?.classList.add('show');
    }

    /**
     * Hide the overlay root (.overlay).
     */
    hide() {
        const root = this._$('.overlay') || this.shadowRoot.firstElementChild;
        root?.classList.remove('show');
    }

    /**
     * Whether the overlay is currently visible.
     * @returns {boolean}
     */
    isVisible() {
        const root = this._$('.overlay') || this.shadowRoot.firstElementChild;
        return root?.classList.contains('show') ?? false;
    }

    /**
     * Dispatch a composed, bubbling CustomEvent.
     * @param {string} name
     * @param {any}    [detail]
     */
    _emit(name, detail) {
        this.dispatchEvent(new CustomEvent(name, {
            bubbles: true,
            composed: true,
            detail,
        }));
    }
}
