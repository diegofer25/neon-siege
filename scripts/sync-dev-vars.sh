#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_FILE="$ROOT_DIR/server-cf/.dev.vars"

infisical export --env=dev --path=/neon-td --format=dotenv > "$OUT_FILE"

append_if_missing() {
  local key="$1"
  local value="$2"
  if ! grep -q "^${key}=" "$OUT_FILE"; then
    echo "${key}=${value}" >> "$OUT_FILE"
  fi
}

append_if_missing "NODE_ENV" "development"
append_if_missing "JWT_SECRET" "dev-jwt-secret"
append_if_missing "JWT_REFRESH_SECRET" "dev-jwt-refresh-secret"
append_if_missing "SCORE_HMAC_SECRET" "dev-score-hmac-secret"
append_if_missing "SAVE_HMAC_SECRET" "dev-save-hmac-secret"
append_if_missing "CONTINUE_TOKEN_SECRET" "dev-continue-token-secret"
append_if_missing "GOOGLE_CLIENT_ID" ""
append_if_missing "APP_BASE_URL" "http://localhost:8080"
append_if_missing "GEOIP_ENABLED" "true"
append_if_missing "ALLOWED_ORIGINS" ""
append_if_missing "EMAIL_FROM" "Neon Siege <noreply@diegolamarao.com>"
append_if_missing "RESEND_API_KEY" ""
append_if_missing "STRIPE_SECRET_KEY" ""
append_if_missing "STRIPE_WEBHOOK_SECRET" ""
append_if_missing "STRIPE_PRICE_ID" ""

echo "Generated $OUT_FILE"
