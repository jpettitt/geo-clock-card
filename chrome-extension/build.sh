#!/usr/bin/env bash
# Assemble the loadable Chrome extension into chrome-extension/build/.
#
# The extension is a flat directory: the new-tab page + bootstrap, the
# shared headless/config modules, the card bundle, and ALL of its assets
# (NASA imagery, timezone GeoJSON) side by side, so geo-clock-card.js's
# `new URL('.', import.meta.url)` imagery base resolves to the extension
# root and nothing is fetched off the network.
#
# Usage:
#   chrome-extension/build.sh            # rebuild card, then assemble
#   chrome-extension/build.sh --no-build # assemble from existing dist/
#
# Then load chrome-extension/build/ via chrome://extensions →
# "Load unpacked". build/ is generated and git-ignored.

set -euo pipefail

EXT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$EXT_DIR/.." && pwd)"
BUILD="$EXT_DIR/build"

# Flags (order-independent):
#   --no-build  assemble from the existing dist/ without rebuilding the card
#   --zip       after assembling, produce a Chrome Web Store upload ZIP
DO_BUILD=1
DO_ZIP=0
for arg in "$@"; do
  case "$arg" in
    --no-build) DO_BUILD=0 ;;
    --zip) DO_ZIP=1 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

if [[ "$DO_BUILD" == 1 ]]; then
  echo "Building card bundle …"
  ( cd "$REPO" && npm run build )
fi

if [[ ! -f "$REPO/dist/geo-clock-card.js" ]]; then
  echo "error: $REPO/dist/geo-clock-card.js not found — run 'npm run build'." >&2
  exit 1
fi

echo "Assembling extension into $BUILD …"
# Wipe so files removed upstream don't linger in a stale build.
rm -rf "$BUILD"
mkdir -p "$BUILD/icons"

# 1. Card bundle + assets. Exclude the source map — it leaks source
#    structure and isn't needed at runtime (same rule the CDN deploy uses).
for f in "$REPO"/dist/*; do
  case "$f" in
    *.map) continue ;;
    *) cp "$f" "$BUILD/" ;;
  esac
done

# 2. Shared headless mount helpers + the Customize panel, imported by
#    newtab.js exactly as the web demo imports them.
cp "$REPO/docs/web/geoclock-config.js" "$BUILD/"
cp "$REPO/docs/web/geoclock-webconfig.js" "$BUILD/"

# 3. Extension shell.
cp "$EXT_DIR/manifest.json" "$BUILD/"
cp "$EXT_DIR/newtab.html" "$BUILD/"
cp "$EXT_DIR/newtab.js" "$BUILD/"
cp "$EXT_DIR"/icons/*.png "$BUILD/icons/"

echo "Done. Load unpacked: $BUILD"
echo "Bundled $(find "$BUILD" -type f | wc -l | tr -d ' ') files, $(du -sh "$BUILD" | cut -f1) total."

if [[ "$DO_ZIP" == 1 ]]; then
  # The Chrome Web Store wants a ZIP whose ROOT is the manifest (i.e. zip
  # the CONTENTS of build/, not the build/ folder). Name it by the
  # manifest version so uploads are traceable. macOS metadata (.DS_Store,
  # AppleDouble ._*) is excluded — CWS rejects unexpected files.
  VERSION="$(node -p "require('$BUILD/manifest.json').version")"
  ZIP="$EXT_DIR/geoclock-newtab-$VERSION.zip"
  rm -f "$ZIP"
  ( cd "$BUILD" && zip -rq -X "$ZIP" . -x '.*' -x '*/.*' )
  echo "Packaged for Chrome Web Store: $ZIP ($(du -h "$ZIP" | cut -f1))"
fi
