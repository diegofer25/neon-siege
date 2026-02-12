/**
 * Rewarded ad adapter contract.
 *
 * Providers should implement this class and inject an instance into
 * `MonetizationManager` via `setAdapter(...)`.
 */
export class RewardedAdAdapter {
    /**
     * @param {string} _placement
     * @param {Object} _context
     * @returns {Promise<boolean>}
     */
    async isRewardedAvailable() {
        return false;
    }

    /**
     * @param {string} _placement
     * @param {Object} _context
     * @returns {Promise<{ shown: boolean, completed: boolean, rewardGranted?: boolean, metadata?: Object }>} 
     */
    async showRewarded() {
        return {
            shown: false,
            completed: false,
            rewardGranted: false
        };
    }
}

export class NoopRewardedAdAdapter extends RewardedAdAdapter {}
