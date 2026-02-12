import { telemetry } from './TelemetryManager.js';
import { consentManager } from './ConsentManager.js';
import { NoopRewardedAdAdapter } from './adapters/RewardedAdAdapter.js';

/**
 * Monetization abstraction layer.
 *
 * This class centralizes rewarded-ad flow hooks so platform-specific SDKs
 * can be integrated without changing gameplay modules.
 */
export class MonetizationManager {
    constructor() {
        this.mockRewardedEnabled = this._readMockFlag();
        this.rewardedAdapter = this._resolveInitialAdapter();
    }

    setAdapter(adapter) {
        if (!adapter) {
            this.rewardedAdapter = new NoopRewardedAdAdapter();
            return;
        }
        this.rewardedAdapter = adapter;
    }

    async registerOpportunity(placement, context = {}) {
        if (!consentManager.canServeAds()) {
            telemetry.track('rewarded_opportunity_blocked', {
                placement,
                reason: 'ads_consent_not_granted',
                ...context
            });
            return;
        }

        const available = this.mockRewardedEnabled
            ? true
            : await this.rewardedAdapter.isRewardedAvailable(placement, context);

        telemetry.track('rewarded_opportunity', {
            placement,
            available,
            ...context
        });

        if (!available) {
            telemetry.track('rewarded_unavailable', {
                placement,
                reason: 'adapter_unavailable',
                ...context
            });
        }
    }

    /**
     * Attempt to show a rewarded ad.
     *
     * Current behavior:
     * - Mock mode (`?rewardedMock=true`): simulate success and grant reward
     * - Default mode: emit unavailable event and return false
     */
    async tryShowRewarded(placement, context = {}, onRewardGranted = null) {
        if (!consentManager.canServeAds()) {
            telemetry.track('rewarded_blocked', {
                placement,
                reason: 'ads_consent_not_granted',
                ...context
            });
            return { shown: false, rewardGranted: false };
        }

        telemetry.track('rewarded_request', {
            placement,
            ...context
        });

        if (this.mockRewardedEnabled) {
            telemetry.track('rewarded_shown', {
                placement,
                source: 'mock',
                ...context
            });

            if (typeof onRewardGranted === 'function') {
                onRewardGranted();
            }

            telemetry.track('rewarded_completed', {
                placement,
                source: 'mock',
                ...context
            });

            telemetry.track('rewarded_reward_granted', {
                placement,
                source: 'mock',
                ...context
            });

            return { shown: true, rewardGranted: true };
        }

        const isAvailable = await this.rewardedAdapter.isRewardedAvailable(placement, context);
        if (!isAvailable) {
            telemetry.track('rewarded_unavailable', {
                placement,
                reason: 'adapter_unavailable',
                ...context
            });
            return { shown: false, rewardGranted: false };
        }

        try {
            const result = await this.rewardedAdapter.showRewarded(placement, context);

            if (!result?.shown) {
                telemetry.track('rewarded_not_shown', {
                    placement,
                    reason: 'adapter_declined_show',
                    ...context
                });
                return { shown: false, rewardGranted: false };
            }

            telemetry.track('rewarded_shown', {
                placement,
                source: 'adapter',
                ...context
            });

            if (result.completed) {
                telemetry.track('rewarded_completed', {
                    placement,
                    source: 'adapter',
                    ...context
                });

                if (typeof onRewardGranted === 'function') {
                    onRewardGranted();
                }

                telemetry.track('rewarded_reward_granted', {
                    placement,
                    source: 'adapter',
                    ...context
                });

                return { shown: true, rewardGranted: true };
            }

            telemetry.track('rewarded_incomplete', {
                placement,
                source: 'adapter',
                ...context
            });
            return { shown: true, rewardGranted: false };
        } catch (error) {
            telemetry.track('rewarded_error', {
                placement,
                message: error instanceof Error ? error.message : 'unknown_error',
                ...context
            });
            return { shown: false, rewardGranted: false };
        }
    }

    _resolveInitialAdapter() {
        const globalAdapter = window?.neonRewardedAdapter;
        if (globalAdapter && typeof globalAdapter.showRewarded === 'function') {
            return globalAdapter;
        }
        return new NoopRewardedAdAdapter();
    }

    _readMockFlag() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('rewardedMock') === 'true';
        } catch {
            return false;
        }
    }
}

export const monetizationManager = new MonetizationManager();
