#!/usr/bin/env bash
# Download NASA imagery and resize for the card:
#   - 12 monthly Blue Marble (day) frames from SVS dataset 3523, picked
#     mid-month (day 15) from the 366-frame leap-year cycle
#   - Black Marble 2012 (night)
#
# All public-domain NASA products. Sources:
#   day:   https://svs.gsfc.nasa.gov/3523  (frames 0014, 0045, ..., 0349)
#   night: https://eoimages.gsfc.nasa.gov/images/imagerecords/79000/79765/
#
# Day frames are 4000×2000 PNG @ ~8.5 MB each. We resize to 2048×1024
# JPEG @ q90 (~530 KB each, 6.4 MB for the full set of 12). The raw
# downloads stay in .fetch-tmp/ so re-runs are cached.
#
# Requires: curl + sips (macOS built-in). Linux: swap sips for
# `magick convert in.png -resize 2048x1024! -quality 90 out.jpg`.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSETS="$ROOT/assets"
TMP="$ROOT/.fetch-tmp"
mkdir -p "$ASSETS" "$TMP"

# Frame index for the 15th of each month, leap-year cycle (0-indexed).
# index = (day_of_year_for_15th - 1).
declare -a DAY_FRAMES=(
  "01:0014"  # Jan 15
  "02:0045"  # Feb 15
  "03:0074"  # Mar 15
  "04:0105"  # Apr 15
  "05:0135"  # May 15
  "06:0166"  # Jun 15
  "07:0196"  # Jul 15
  "08:0227"  # Aug 15
  "09:0258"  # Sep 15
  "10:0288"  # Oct 15
  "11:0319"  # Nov 15
  "12:0349"  # Dec 15
)

DAY_FRAME_BASE="https://svs.gsfc.nasa.gov/vis/a000000/a003500/a003523/frames/4000x2000_2x1_10p"
NIGHT_SRC_URL="https://eoimages.gsfc.nasa.gov/images/imagerecords/79000/79765/dnb_land_ocean_ice.2012.3600x1800.jpg"
NIGHT_SRC="$TMP/black-source.jpg"
NIGHT_OUT="$ASSETS/black-marble-2048.jpg"

download() {
  local url="$1" out="$2"
  if [[ -s "$out" ]]; then
    echo "  cached: $(basename "$out")"
    return
  fi
  echo "  downloading: $(basename "$out")"
  curl --fail --location --silent --show-error --output "$out" "$url"
}

resize_to_2048() {
  local in="$1" out="$2"
  echo "  resizing: $(basename "$out")"
  sips --resampleWidth 2048 -s format jpeg -s formatOptions 90 \
       "$in" --out "$out" >/dev/null
}

echo "Blue Marble — 12 monthly daylight frames"
for entry in "${DAY_FRAMES[@]}"; do
  month="${entry%:*}"
  frame="${entry#*:}"
  src_url="${DAY_FRAME_BASE}/SOS_BMarble_BG_09.${frame}.png"
  src="$TMP/blue-${month}.png"
  out="$ASSETS/blue-marble-${month}-2048.jpg"
  download "$src_url" "$src"
  if [[ "$out" -ot "$src" || ! -s "$out" ]]; then
    resize_to_2048 "$src" "$out"
  else
    echo "  cached: $(basename "$out")"
  fi
done

echo
echo "Black Marble — night layer"
download "$NIGHT_SRC_URL" "$NIGHT_SRC"
if [[ "$NIGHT_OUT" -ot "$NIGHT_SRC" || ! -s "$NIGHT_OUT" ]]; then
  resize_to_2048 "$NIGHT_SRC" "$NIGHT_OUT"
else
  echo "  cached: $(basename "$NIGHT_OUT")"
fi

echo
echo "Done. Output:"
ls -lh "$ASSETS"/blue-marble-*-2048.jpg "$NIGHT_OUT"
