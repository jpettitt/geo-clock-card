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

# Aggregate the 120 source features into 25 whole-hour zones,
# replacing each one's polygon with a clean 15° × 180° rectangle.
# The country-shaped source polygons produced ugly triangular
# artifacts at the poles after simplification — the visible overlay's
# job is to mark the meridian zones, and the IANA layer handles
# country detail on hover. Rectangles are valid out of the box, no
# mapshaper simplification needed.
echo "aggregating into rectangle bands..."
node "$ROOT/scripts/aggregate-tz.mjs" "$RAW" "$OUT"

echo
echo "Done. Output:"
ls -lh "$OUT"
