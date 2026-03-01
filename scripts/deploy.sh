#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — One-command deploy for Neon Siege (Workers + Pages)
#
# Usage:
#   ./scripts/deploy.sh <env> [target]
#
#   env:     staging | prod
#   target:  all (default) | worker | pages
#
# Examples:
#   ./scripts/deploy.sh staging          # deploy everything to staging
#   ./scripts/deploy.sh prod             # deploy everything to production
#   ./scripts/deploy.sh prod worker      # deploy only the prod worker
#   ./scripts/deploy.sh staging pages    # deploy only the staging client
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLIENT_DIR="$ROOT_DIR/client"
SERVER_DIR="$ROOT_DIR/server"

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()    { echo -e "${CYAN}▸${NC} $*"; }
success() { echo -e "${GREEN}✔${NC} $*"; }
warn()    { echo -e "${YELLOW}⚠${NC} $*"; }
error()   { echo -e "${RED}✖${NC} $*" >&2; }
header()  { echo -e "\n${BOLD}═══ $* ═══${NC}\n"; }

# ── Args ────────────────────────────────────────────────────────────────────
ENV="${1:-}"
TARGET="${2:-all}"

if [[ -z "$ENV" ]] || [[ "$ENV" != "staging" && "$ENV" != "prod" ]]; then
  error "Usage: $0 <staging|prod> [all|worker|pages]"
  exit 1
fi

if [[ "$TARGET" != "all" && "$TARGET" != "worker" && "$TARGET" != "pages" ]]; then
  error "Invalid target '$TARGET'. Use: all, worker, or pages"
  exit 1
fi

# ── Environment config ──────────────────────────────────────────────────────
if [[ "$ENV" == "prod" ]]; then
  WORKER_DEPLOY_FLAGS=""
  CLIENT_BUILD_SCRIPT="build:prod"
  PAGES_BRANCH="main"
  LABEL="Production"
else
  WORKER_DEPLOY_FLAGS="--env preview"
  CLIENT_BUILD_SCRIPT="build:staging"
  PAGES_BRANCH="staging"
  LABEL="Staging"
fi

header "Deploying ${LABEL}"

# ── Deploy Worker ───────────────────────────────────────────────────────────
deploy_worker() {
  header "Worker → ${LABEL}"

  cd "$SERVER_DIR"

  # Run migrations first
  if [[ "$ENV" == "prod" ]]; then
    info "Running production D1 migrations…"
    npm run db:migrate:prod
  else
    info "Running preview D1 migrations…"
    npm run db:migrate:preview
  fi
  success "Migrations applied"

  info "Deploying worker…"
  # shellcheck disable=SC2086
  npx wrangler deploy $WORKER_DEPLOY_FLAGS
  success "Worker deployed (${LABEL})"
}

# ── Deploy Pages (Client) ──────────────────────────────────────────────────
deploy_pages() {
  header "Pages → ${LABEL}"

  cd "$CLIENT_DIR"

  info "Building client (${CLIENT_BUILD_SCRIPT})…"
  npm run "$CLIENT_BUILD_SCRIPT"
  success "Client built"

  info "Deploying to Cloudflare Pages (branch: ${PAGES_BRANCH})…"
  npx wrangler pages deploy dist \
    --project-name neon-siege \
    --branch "$PAGES_BRANCH" \
    --commit-dirty=true
  success "Pages deployed (${LABEL})"
}

# ── Execute ─────────────────────────────────────────────────────────────────
case "$TARGET" in
  all)
    deploy_worker
    deploy_pages
    ;;
  worker)
    deploy_worker
    ;;
  pages)
    deploy_pages
    ;;
esac

header "Done — ${LABEL} deployment complete ✓"
