/**
 * Rewarded ad adapter contract.
 *
 * Providers should implement this class and inject an instance into
 * `MonetizationManager` via `setAdapter(...)`.
 */
export class RewardedAdAdapter {
    /**
     * @param {string} placement
     * @param {Object} context
     * @returns {Promise<boolean>}
     */
    async isRewardedAvailable(placement, context) {
        void placement;
        void context;
        return false;
    }

    /**
     * @param {string} placement
     * @param {Object} context
     * @returns {Promise<{ shown: boolean, completed: boolean, rewardGranted?: boolean, metadata?: Object }>} 
     */
    async showRewarded(placement, context) {
        void placement;
        void context;
        return {
            shown: false,
            completed: false,
            rewardGranted: false
        };
    }
}

export class NoopRewardedAdAdapter extends RewardedAdAdapter {}
