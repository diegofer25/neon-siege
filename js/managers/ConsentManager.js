const DEFAULT_CONSENT = Object.freeze({
    consentVersion: 1,
    hasDecision: false,
    analytics: false,
    ads: false,
    personalizedAds: false,
    updatedAt: 0
});

/**
 * Consent manager for analytics and advertising permissions.
 *
 * Persists user choices and provides runtime access checks used by
 * telemetry and monetization modules.
 */
export class ConsentManager {
    constructor(storageKey = 'neon_td_consent_v1') {
        this.storageKey = storageKey;
        this.state = this._loadState();
    }

    hasDecision() {
        return this.state.hasDecision;
    }

    canTrackAnalytics() {
        return this.state.hasDecision && this.state.analytics;
    }

    canServeAds() {
        return this.state.hasDecision && this.state.ads;
    }

    canServePersonalizedAds() {
        return this.canServeAds() && this.state.personalizedAds;
    }

    getSnapshot() {
        return { ...this.state };
    }

    acceptAll() {
        this._setState({
            hasDecision: true,
            analytics: true,
            ads: true,
            personalizedAds: true
        });
    }

    acceptEssentialOnly() {
        this._setState({
            hasDecision: true,
            analytics: false,
            ads: false,
            personalizedAds: false
        });
    }

    saveCustomPreferences(preferences = {}) {
        const adsEnabled = !!preferences.ads;
        this._setState({
            hasDecision: true,
            analytics: !!preferences.analytics,
            ads: adsEnabled,
            personalizedAds: adsEnabled && !!preferences.personalizedAds
        });
    }

    bindUI() {
        const overlay = document.getElementById('consentScreen');
        if (!overlay) {
            return;
        }

        this._syncFormFromState();
        this._applyVisibility();

        document.getElementById('consentAcceptAllBtn')?.addEventListener('click', () => {
            this.acceptAll();
            this._applyVisibility();
        });

        document.getElementById('consentEssentialBtn')?.addEventListener('click', () => {
            this.acceptEssentialOnly();
            this._applyVisibility();
        });

        document.getElementById('consentSaveBtn')?.addEventListener('click', () => {
            const analytics = !!document.getElementById('consentAnalytics')?.checked;
            const ads = !!document.getElementById('consentAds')?.checked;
            const personalizedAds = !!document.getElementById('consentPersonalizedAds')?.checked;

            this.saveCustomPreferences({
                analytics,
                ads,
                personalizedAds
            });
            this._applyVisibility();
        });

        document.getElementById('consentManageBtn')?.addEventListener('click', () => {
            this.showConsentPrompt();
        });
    }

    showConsentPrompt() {
        const overlay = document.getElementById('consentScreen');
        if (!overlay) {
            return;
        }
        this._syncFormFromState();
        overlay.classList.add('show');
    }

    hideConsentPrompt() {
        const overlay = document.getElementById('consentScreen');
        if (!overlay) {
            return;
        }
        overlay.classList.remove('show');
    }

    _setState(update) {
        this.state = {
            ...this.state,
            ...update,
            updatedAt: Date.now()
        };
        this._saveState();

        document.dispatchEvent(
            new CustomEvent('neon:consent-updated', {
                detail: this.getSnapshot()
            })
        );
    }

    _applyVisibility() {
        if (this.hasDecision()) {
            this.hideConsentPrompt();
            return;
        }
        this.showConsentPrompt();
    }

    _syncFormFromState() {
        const analyticsCheckbox = document.getElementById('consentAnalytics');
        const adsCheckbox = document.getElementById('consentAds');
        const personalizedAdsCheckbox = document.getElementById('consentPersonalizedAds');

        if (analyticsCheckbox) {
            analyticsCheckbox.checked = this.state.analytics;
        }
        if (adsCheckbox) {
            adsCheckbox.checked = this.state.ads;
        }
        if (personalizedAdsCheckbox) {
            personalizedAdsCheckbox.checked = this.state.personalizedAds;
            personalizedAdsCheckbox.disabled = !this.state.ads;
        }

        if (adsCheckbox && personalizedAdsCheckbox) {
            adsCheckbox.onchange = () => {
                const isAdsEnabled = adsCheckbox.checked;
                personalizedAdsCheckbox.disabled = !isAdsEnabled;
                if (!isAdsEnabled) {
                    personalizedAdsCheckbox.checked = false;
                }
            };
        }
    }

    _loadState() {
        if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
            return { ...DEFAULT_CONSENT };
        }

        try {
            const stored = window.localStorage.getItem(this.storageKey);
            if (!stored) {
                return { ...DEFAULT_CONSENT };
            }

            const parsed = JSON.parse(stored);
            return {
                ...DEFAULT_CONSENT,
                ...parsed
            };
        } catch (error) {
            console.warn('[ConsentManager] Failed to load consent preferences', error);
            return { ...DEFAULT_CONSENT };
        }
    }

    _saveState() {
        if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
            return;
        }

        try {
            window.localStorage.setItem(this.storageKey, JSON.stringify(this.state));
        } catch (error) {
            console.warn('[ConsentManager] Failed to save consent preferences', error);
        }
    }
}

export const consentManager = new ConsentManager();
