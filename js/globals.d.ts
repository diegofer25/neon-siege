interface RewardedAdapterLike {
    isRewardedAvailable?: (placement: string, context?: Record<string, unknown>) => Promise<boolean> | boolean;
    showRewarded: (
        placement: string,
        context?: Record<string, unknown>
    ) => Promise<{ shown: boolean; completed?: boolean }> | { shown: boolean; completed?: boolean };
}

declare global {
    interface Window {
        dataLayer?: Array<Record<string, unknown>>;
        gtag?: (...args: unknown[]) => void;
        neonRewardedAdapter?: RewardedAdapterLike;
    }
}

export {};
