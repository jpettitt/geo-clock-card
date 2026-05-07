#!/usr/bin/env bash
# Download Natural Earth 10m time-zones geojson, simplify it down to
# ~60 KB of boundary lines, and write the result to assets/timezones.json.
# Run once; re-run if you want to change the simplification level.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSETS="$ROOT/assets"
TMP="$ROOT/.fetch-tmp"
mkdir -p "$ASSETS" "$TMP"

SRC_URL="https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_time_zones.geojson"
RAW="$TMP/tz-raw.geojson"
OUT="$ASSETS/timezones.json"

if [[ ! -s "$RAW" ]]; then
  echo "downloading: $SRC_URL"
  curl --fail --location --silent --show-error --output "$RAW" "$SRC_URL"
else
  echo "cached: $RAW"
fi

# Simplification pipeline:
#   - simplify to 2% retention (good detail vs. ~62 KB output)
#   - keep-shapes to avoid losing tiny polygons
#   - dissolve adjacent polygons sharing the same `zone` property so
#     internal seams between same-zone shapes vanish
#   - convert to lines (we only want boundaries, not filled polygons)
#   - drop all attributes; geometry is all we render
#   - precision=0.01 → 2 decimal places (~1 km on the equator)
echo "simplifying with mapshaper..."
npx --no-install mapshaper "$RAW" \
  -simplify 2% keep-shapes \
  -dissolve fields=zone copy-fields=zone \
  -lines \
  -filter-fields \
  -o "$OUT" format=geojson precision=0.01 \
  2>&1 | tail -5

echo
echo "Done. Output:"
ls -lh "$OUT"
