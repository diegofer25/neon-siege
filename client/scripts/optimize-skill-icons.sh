#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ICON_DIR="${ROOT_DIR}/assets/icons/skills"
MAX_SIZE="${1:-128}"
QUALITY="${2:-78}"

if [[ ! -d "${ICON_DIR}" ]]; then
  echo "Icon directory not found: ${ICON_DIR}" >&2
  exit 1
fi

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick (magick) is required. Install with: brew install imagemagick" >&2
  exit 1
fi

count_before=$(find "${ICON_DIR}" -maxdepth 1 -type f -name '*.jpg' | wc -l | tr -d ' ')
kb_before=$(du -ck "${ICON_DIR}"/*.jpg | tail -1 | awk '{print $1}')

echo "Optimizing ${count_before} skill icons"
echo "Target max size: ${MAX_SIZE}px, quality: ${QUALITY}"
echo "Before: ${kb_before} KB"

magick mogrify \
  -strip \
  -interlace Plane \
  -sampling-factor 4:2:0 \
  -filter Lanczos \
  -resize "${MAX_SIZE}x${MAX_SIZE}>" \
  -quality "${QUALITY}" \
  "${ICON_DIR}"/*.jpg

kb_after=$(du -ck "${ICON_DIR}"/*.jpg | tail -1 | awk '{print $1}')
reduction=$(python3 - <<PY
before = float(${kb_before})
after = float(${kb_after})
print(f"{((before-after)/before)*100:.1f}" if before > 0 else "0.0")
PY
)

echo "After:  ${kb_after} KB"
echo "Saved:  $((kb_before - kb_after)) KB (${reduction}%)"
