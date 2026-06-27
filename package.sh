#!/bin/bash

# Package "Bing it" extension for Chrome/Edge Web Store upload
# Usage: ./package.sh
# Output: bing-it-v{version}.zip

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
MANIFEST="$ROOT/manifest.json"

VERSION=$(grep '"version"' "$MANIFEST" | head -1 | sed 's/.*"version".*"\([^"]*\)".*/\1/')
FILENAME="bing-it-v${VERSION}.zip"

echo "📦 Packaging Bing it v${VERSION}..."

rm -f "$ROOT/$FILENAME"

cd "$ROOT"

zip -r "$FILENAME" \
  manifest.json \
  scripts/ \
  popup/ \
  options/ \
  assets/ \
  -x "*.DS_Store" \
  -x "assets/icon.svg" \
  -x "response.xml"

SIZE=$(du -h "$FILENAME" | cut -f1)

echo ""
echo "✅ Done! Package ready at:"
echo "   $FILENAME ($SIZE)"
echo ""
echo "Upload this file to:"
echo "   • Chrome Web Store: https://chrome.google.com/webstore/devconsole"
echo "   • Edge Add-ons:     https://partner.microsoft.com/en-us/dashboard/microsoftedge"
