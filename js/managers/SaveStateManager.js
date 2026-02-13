import { telemetry } from './TelemetryManager.js';

const SAVE_STORAGE_KEY = 'neon_td_save_v2';
const SAVE_SCHEMA_VERSION = 2;

export class SaveStateManager {
    hasSave() {
        return !!this.getRawSave();
    }

    getRawSave() {
        try {
            const raw = localStorage.getItem(SAVE_STORAGE_KEY);
            if (!raw) {
                return null;
            }
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') {
                return null;
            }
            return parsed;
        } catch {
            return null;
        }
    }

    saveSnapshot(snapshot) {
        const payload = {
            schemaVersion: SAVE_SCHEMA_VERSION,
            savedAt: Date.now(),
            ...snapshot
        };

        try {
            localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
            telemetry.track('save_created', {
                wave: payload.wave,
                checkpointWave: payload.checkpointWave,
                gameState: payload.gameState
            });
            return true;
        } catch {
            return false;
        }
    }

    clearSave() {
        try {
            localStorage.removeItem(SAVE_STORAGE_KEY);
            telemetry.track('save_cleared');
            return true;
        } catch {
            return false;
        }
    }
}

export const saveStateManager = new SaveStateManager();
