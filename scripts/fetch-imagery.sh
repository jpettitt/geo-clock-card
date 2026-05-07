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

# Frame indices into the SVS 366-frame leap-year cycle (0-indexed).
# Two frames per month: day 1 (start) and day 15 (mid).
declare -a DAY_FRAMES=(
  "01-start:0000"  # Jan  1
  "01-mid:0014"    # Jan 15
  "02-start:0031"  # Feb  1
  "02-mid:0045"    # Feb 15
  "03-start:0060"  # Mar  1
  "03-mid:0074"    # Mar 15
  "04-start:0091"  # Apr  1
  "04-mid:0105"    # Apr 15
  "05-start:0121"  # May  1
  "05-mid:0135"    # May 15
  "06-start:0152"  # Jun  1
  "06-mid:0166"    # Jun 15
  "07-start:0182"  # Jul  1
  "07-mid:0196"    # Jul 15
  "08-start:0213"  # Aug  1
  "08-mid:0227"    # Aug 15
  "09-start:0244"  # Sep  1
  "09-mid:0258"    # Sep 15
  "10-start:0274"  # Oct  1
  "10-mid:0288"    # Oct 15
  "11-start:0305"  # Nov  1
  "11-mid:0319"    # Nov 15
  "12-start:0335"  # Dec  1
  "12-mid:0349"    # Dec 15
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

echo "Blue Marble — 24 daylight frames (start + mid of each month)"
for entry in "${DAY_FRAMES[@]}"; do
  tag="${entry%:*}"   # e.g. "01-mid"
  frame="${entry#*:}" # e.g. "0014"
  src_url="${DAY_FRAME_BASE}/SOS_BMarble_BG_09.${frame}.png"
  src="$TMP/blue-${tag}.png"
  out="$ASSETS/blue-marble-${tag}-2048.jpg"
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
