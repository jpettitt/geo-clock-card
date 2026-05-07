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
AGG="$TMP/tz-aggregated.geojson"
OUT="$ASSETS/timezones.json"

if [[ ! -s "$RAW" ]]; then
  echo "downloading: $SRC_URL"
  curl --fail --location --silent --show-error --output "$RAW" "$SRC_URL"
else
  echo "cached: $RAW"
fi

# Aggregation step (Node): merge polygons per zone and union all the
# `places` tokens into one deduped, country-first string. Without this
# mapshaper's -dissolve only keeps the first feature's `places`, which
# is often an ocean / polar strip rather than the populated regions.
echo "aggregating places per zone..."
node "$ROOT/scripts/aggregate-tz.mjs" "$RAW" "$AGG"

# Simplification:
#   - simplify to 2% retention (good detail vs. <100 KB output)
#   - keep-shapes to avoid losing tiny polygons
#   - retain only the fields the card actually needs
#   - precision=0.01 → 2 decimal places (~1 km on the equator)
echo "simplifying with mapshaper..."
npx --no-install mapshaper "$AGG" \
  -simplify 2% keep-shapes \
  -filter-fields zone,time_zone,name,places \
  -o "$OUT" format=geojson precision=0.01 \
  2>&1 | tail -5

echo
echo "Done. Output:"
ls -lh "$OUT"
