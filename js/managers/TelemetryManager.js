/**
 * Lightweight telemetry manager for analytics and monetization instrumentation.
 *
 * Dispatches events to:
 * - `window.gtag` when available
 * - `window.dataLayer` when available
 * - `document` as CustomEvent (`neon:telemetry`) for local listeners
 */
import { consentManager } from './ConsentManager.js';

export class TelemetryManager {
    constructor() {
        this.sessionId = null;
        this.sessionStartTime = 0;
        this.debugEnabled = this._readDebugFlag();
    }

    startSession(context = {}) {
        this.sessionId = this._createSessionId();
        this.sessionStartTime = Date.now();
        this.track('session_start', context);
    }

    endSession(reason = 'unknown', context = {}) {
        if (!this.sessionId) {
            return;
        }

        const durationMs = Math.max(0, Date.now() - this.sessionStartTime);
        this.track('session_end', {
            reason,
            durationMs,
            ...context
        });

        this.sessionId = null;
        this.sessionStartTime = 0;
    }

    track(eventName, payload = {}) {
        const event = {
            eventName,
            payload,
            timestamp: Date.now(),
            sessionId: this.sessionId
        };

        if (consentManager.canTrackAnalytics()) {
            this._emitToDataLayer(event);
            this._emitToGtag(event);
        }
        this._emitToDocument(event);

        if (this.debugEnabled) {
            console.info('[Telemetry]', eventName, event);
        }
    }

    _emitToDataLayer(event) {
        if (!window.dataLayer || typeof window.dataLayer.push !== 'function') {
            return;
        }

        window.dataLayer.push({
            event: event.eventName,
            ...event.payload,
            session_id: event.sessionId,
            event_timestamp: event.timestamp
        });
    }

    _emitToGtag(event) {
        if (typeof window.gtag !== 'function') {
            return;
        }

        window.gtag('event', event.eventName, {
            ...event.payload,
            session_id: event.sessionId,
            event_timestamp: event.timestamp
        });
    }

    _emitToDocument(event) {
        if (typeof document?.dispatchEvent !== 'function') {
            return;
        }

        document.dispatchEvent(new CustomEvent('neon:telemetry', { detail: event }));
    }

    _createSessionId() {
        if (typeof crypto?.randomUUID === 'function') {
            return crypto.randomUUID();
        }

        return `session_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
    }

    _readDebugFlag() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('telemetry') === 'true';
        } catch {
            return false;
        }
    }
}

export const telemetry = new TelemetryManager();
