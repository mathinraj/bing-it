#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
CONFIG_FILE="scripts/config.js"
EXT_NAME="bing-it"

rm -f "$REPO_ROOT"/${EXT_NAME}-for-*.zip

echo "bing it v${VERSION} — Building store packages"
echo "================================================"

# ── Chrome ─────────────────────────────────────────
echo ""
echo "[1/2] Chrome Web Store ..."
echo "const BINGIT_STORE = 'chrome';" > "$CONFIG_FILE"

CHROME_ZIP="$REPO_ROOT/${EXT_NAME}-for-chrome-${VERSION}.zip"
zip -r "$CHROME_ZIP" \
  manifest.json \
  scripts/ \
  popup/ \
  options/ \
  assets/ \
  -x "*.DS_Store" \
  -x "assets/icon.svg" \
  -x "response.xml" > /dev/null

echo "  → $CHROME_ZIP ($(du -h "$CHROME_ZIP" | cut -f1))"

# ── Firefox (uncomment when ready to publish) ──────
# echo ""
# echo "[2/2] Firefox Add-ons ..."
# echo "const BINGIT_STORE = 'firefox';" > "$CONFIG_FILE"
#
# FIREFOX_ZIP="$REPO_ROOT/${EXT_NAME}-for-firefox-${VERSION}.zip"
# zip -r "$FIREFOX_ZIP" \
#   manifest.json \
#   scripts/ \
#   popup/ \
#   options/ \
#   assets/ \
#   -x "*.DS_Store" \
#   -x "assets/icon.svg" \
#   -x "response.xml" > /dev/null
#
# echo "  → $FIREFOX_ZIP ($(du -h "$FIREFOX_ZIP" | cut -f1))"

# Reset config back to Chrome default
echo "const BINGIT_STORE = 'chrome';" > "$CONFIG_FILE"

echo ""
echo "================================================"
echo "Done!"
ls -lh "$REPO_ROOT"/${EXT_NAME}-for-*.zip
echo ""
echo "Upload Chrome zip to:"
echo "  https://chrome.google.com/webstore/devconsole"
