#!/usr/bin/env bash
# Download timezone-boundary-builder's full IANA polygon set (~419
# zones, ~50 MB zipped) and simplify it to ~1 MB. The output is the
# dataset the card uses for DST-aware hover hit-testing — we feed
# (lat, lon) → IANA tzid and let `Intl.DateTimeFormat` handle the
# daylight-savings math.
#
# We use the full set (not "now" or "1970") so every Caribbean island
# and small territory has its own polygon — otherwise small islands
# get folded under whichever larger neighbor has identical current
# rules and the popup mis-attributes them.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSETS="$ROOT/assets"
TMP="$ROOT/.fetch-tmp"
mkdir -p "$ASSETS" "$TMP/tz-iana-full"

# Pin to a specific release tag so re-runs are deterministic.
RELEASE="2026b"
SRC_URL="https://github.com/evansiroky/timezone-boundary-builder/releases/download/${RELEASE}/timezones.geojson.zip"
ZIP="$TMP/tz-iana-full.zip"
RAW="$TMP/tz-iana-full/combined.json"
OUT="$ASSETS/timezones-iana.json"

if [[ ! -s "$ZIP" ]]; then
  echo "downloading ($RELEASE): $SRC_URL"
  curl --fail --location --silent --show-error --output "$ZIP" "$SRC_URL"
else
  echo "cached: $ZIP"
fi

if [[ ! -s "$RAW" ]]; then
  echo "unzipping..."
  unzip -o -q "$ZIP" -d "$TMP/tz-iana-full"
fi

echo "simplifying with mapshaper (1%)..."
npx --no-install mapshaper "$RAW" \
  -simplify 1% keep-shapes \
  -filter-fields tzid \
  -o "$OUT" format=geojson precision=0.01 \
  2>&1 | tail -3

echo
echo "Done. Output:"
ls -lh "$OUT"
