#!/usr/bin/env bash
# Render the PWA install icons (docs/web/icon-*.png) from the SVG
# sources in assets/. The PNGs are committed — the site has no build
# step — so run this only when the brand mark changes, then commit
# the results.
#
# rsvg-convert is used (same as geoclock-wallpaper-mac's
# generate-icons.sh) because it renders SVG deterministically across
# machines and CI runners. Fallback if librsvg is unavailable:
# rasterize the SVGs once in any browser canvas at 192/512 and save
# the PNGs by hand — the sources are simple two-tone shapes.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "error: rsvg-convert not found — brew install librsvg" >&2
  exit 1
fi

rsvg-convert -w 192 -h 192 assets/icon-source.svg -o docs/web/icon-192.png
rsvg-convert -w 512 -h 512 assets/icon-source.svg -o docs/web/icon-512.png
rsvg-convert -w 512 -h 512 assets/icon-maskable.svg -o docs/web/icon-512-maskable.png

echo "wrote docs/web/icon-192.png, icon-512.png, icon-512-maskable.png"
