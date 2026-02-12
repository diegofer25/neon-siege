# Monetization & Telemetry Baseline

This project now includes a lightweight instrumentation layer for monetization rollout.

## Modules

- `js/managers/TelemetryManager.js`
- `js/managers/MonetizationManager.js`
- `js/managers/adapters/RewardedAdAdapter.js`

## Debug Query Flags

- `?telemetry=true` logs telemetry events to the browser console.
- `?rewardedMock=true` enables mocked rewarded-ad success flow (no real SDK).

Example:

- `http://localhost:8080/?telemetry=true&rewardedMock=true`

## Consent Gating

- Consent is managed by `js/managers/ConsentManager.js` and persisted in localStorage.
- Runtime consent UI appears in `index.html` as `#consentScreen` and can be reopened with the ⚖️ HUD button.
- External analytics sinks (`gtag`, `dataLayer`) are blocked until analytics consent is granted.
- Rewarded ad opportunities and rewarded display attempts are blocked until ads consent is granted.
- Start is blocked until a consent choice is made.

## Event Schema (v1)

All events include:

- `eventName`
- `timestamp`
- `sessionId` (when a session is active)

### App/Session

- `app_initialized`
  - `userAgent`, `viewportWidth`, `viewportHeight`
- `session_start`
  - `entryPoint`, `statsOverlayEnabled`
- `session_end`
  - `reason`, `durationMs`, optional run summary fields

### Gameplay

- `run_start`
  - `wave`, `playerHp`, `playerMaxHp`
- `wave_start`
  - `wave`, `playerHp`, `coins`
- `wave_complete`
  - `wave`, `coinsRewarded`, `remainingHp`, `isBossWave`
- `game_over`
  - `wave`, `score`, `coins`
- `run_restart`
  - `fromWave`, `score`

### Economy

- `shop_purchase`
  - `wave`, `powerUp`, `price`, `coinsAfterPurchase`
- `shop_purchase_failed`
  - `wave`, `powerUp`, `price`, `coinsAvailable`

### Rewarded Ads (Hook Layer)

- `rewarded_opportunity`
  - `placement`, plus contextual fields
- `rewarded_opportunity_blocked`
  - `placement`, `reason`
- `rewarded_request`
  - `placement`, plus contextual fields
- `rewarded_blocked`
  - `placement`, `reason`
- `rewarded_unavailable`
  - `placement`, `reason`
- `rewarded_shown`
  - `placement`
- `rewarded_completed`
  - `placement`
- `rewarded_reward_granted`
  - `placement`
- `rewarded_bonus_applied`
  - `placement`, `wave`, `bonus`

## Integration Notes

- `TelemetryManager` auto-emits to:
  - `window.gtag` if present
  - `window.dataLayer` if present
  - `document` custom event: `neon:telemetry`
- `MonetizationManager` is an abstraction point for future SDK integration.
- `MonetizationManager` resolves `window.neonRewardedAdapter` automatically if available.
- Current rewarded flow supports:
  - mock mode (`?rewardedMock=true`)
  - adapter mode (via `setAdapter(...)` or `window.neonRewardedAdapter`)

## Rewarded Adapter Contract

Implement the adapter contract in `js/managers/adapters/RewardedAdAdapter.js`:

- `isRewardedAvailable(placement, context) => Promise<boolean>`
- `showRewarded(placement, context) => Promise<{ shown, completed, rewardGranted? }>`

The game currently exposes one production placement:

- Between waves in shop footer (`Watch Ad: +50% Wave Coins`)

## Next Step (SDK Wiring)

Implement provider-specific behavior inside `MonetizationManager.tryShowRewarded(...)`:

1. Check ad availability/load state
2. Show rewarded ad
3. Confirm completion callback
4. Execute `onRewardGranted` exactly once
5. Emit success/failure telemetry events
