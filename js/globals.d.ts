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
        __NEON_TRACE_ENABLED__?: boolean;
    }

    interface HTMLCanvasElement {
        logicalWidth?: number;
        logicalHeight?: number;
    }

    // ── Web Component custom element types ──
    interface PauseScreenElement extends HTMLElement {
        show(): void;
        hide(): void;
    }

    interface WaveCountdownElement extends HTMLElement {
        show(): void;
        hide(): void;
        setText(label: string): void;
        setGo(isGo: boolean): void;
        restartAnimation(): void;
    }

    interface AchievementToastElement extends HTMLElement {
        showToast(icon: string, name: string): void;
        hideToast(): void;
    }

    interface FloatingTextsElement extends HTMLElement {
        addText(text: string, x: number, y: number, className?: string): void;
    }

    interface GameOverScreenElement extends HTMLElement {
        show(): void;
        hide(): void;
        setStats(stats: { wave: number; score: number; combo: number; level: number }): void;
        setNewRecord(isNew: boolean): void;
        setNearMiss(text: string | null): void;
        setLoadSaveVisible(visible: boolean): void;
    }

    interface VictoryScreenElement extends HTMLElement {
        show(): void;
        hide(): void;
        setStats(stats: { wave: number; score: number; combo: number; level: number; kills: number }): void;
        setNewRecord(isNew: boolean): void;
    }

    interface StartScreenElement extends HTMLElement {
        show(): void;
        hide(): void;
        setLastRunStats(stats: { lastWave?: number; lastScore?: number; bestWave?: number; bestScore?: number }): void;
        setLoadSaveVisible(visible: boolean): void;
        getSelectedDifficulty(): string;
        setDifficulty(difficulty: string): void;
    }

    interface SettingsModalElement extends HTMLElement {
        show(): void;
        hide(): void;
        updateUI(settings: Record<string, unknown>): void;
        setSaveButtonStates(states: { hasSave: boolean }): void;
        setDevPanelVisible(visible: boolean): void;
        setKeybindHintsVisible(visible: boolean): void;
        isVisible(): boolean;
    }

    interface LevelUpPanelElement extends HTMLElement {
        show(): void;
        hide(): void;
        setTitle(text: string): void;
        setPoints(attrPts: number, skillPts: number): void;
        setButtonStates(states: { resetDisabled: boolean; confirmDisabled: boolean; confirmReady: boolean }): void;
        getViewport(): HTMLElement | null;
        showOnboarding(): void;
        hideOnboarding(): void;
    }

    interface AscensionPanelElement extends HTMLElement {
        show(): void;
        hide(): void;
        setOptions(options: Array<{ id: string; name: string; description: string; icon?: string; iconImage?: string }>, iconRenderer: (mod: any, size: number) => string): void;
    }

    interface HudTooltipElement extends HTMLElement {
        readonly isShown: boolean;
        showTooltip(info: { icon: string; iconImage?: string; name: string; meta: string; desc: string; cd?: string; type: string }, iconHtml: string): void;
        hideTooltip(): void;
        positionTooltip(cx: number, cy: number): void;
    }

    interface GameHudElement extends HTMLElement {
        // No public API — HUDManager accesses nested sub-component shadowRoots directly
    }

    // ── Global primitives ──
    interface NeonButtonElement extends HTMLElement {
        variant: string;
        disabled: boolean;
        ready: boolean;
        label: string;
    }

    // ── HUD sub-components (no public API — accessed via HUDManager) ──
    interface HudHealthBarsElement extends HTMLElement {}
    interface HudSkillBarElement extends HTMLElement {}
    interface HudPassiveSlotsElement extends HTMLElement {}
    interface HudAscensionBadgesElement extends HTMLElement {}
    interface HudWaveCounterElement extends HTMLElement {}
    interface HudScoreElement extends HTMLElement {}
    interface HudComboElement extends HTMLElement {}
    interface HudStatsElement extends HTMLElement {}
    interface HudChallengesElement extends HTMLElement {}
    interface HudPerformanceElement extends HTMLElement {}
    interface HudSettingsElement extends HTMLElement {}

    interface HTMLElementTagNameMap {
        'pause-screen': PauseScreenElement;
        'wave-countdown': WaveCountdownElement;
        'achievement-toast': AchievementToastElement;
        'floating-texts': FloatingTextsElement;
        'game-over-screen': GameOverScreenElement;
        'victory-screen': VictoryScreenElement;
        'start-screen': StartScreenElement;
        'settings-modal': SettingsModalElement;
        'level-up-panel': LevelUpPanelElement;
        'ascension-panel': AscensionPanelElement;
        'hud-tooltip': HudTooltipElement;
        'game-hud': GameHudElement;
        'neon-button': NeonButtonElement;
        'hud-health-bars': HudHealthBarsElement;
        'hud-skill-bar': HudSkillBarElement;
        'hud-passive-slots': HudPassiveSlotsElement;
        'hud-ascension-badges': HudAscensionBadgesElement;
        'hud-wave-counter': HudWaveCounterElement;
        'hud-score': HudScoreElement;
        'hud-combo': HudComboElement;
        'hud-stats': HudStatsElement;
        'hud-challenges': HudChallengesElement;
        'hud-performance': HudPerformanceElement;
        'hud-settings': HudSettingsElement;
    }
}

export {};
