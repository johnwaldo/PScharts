#!/usr/bin/env bash
# Packages the PScharts Chrome extension into a distributable ZIP.
# Output: dist/pscharts.zip

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$SCRIPT_DIR/extension"
OUT="$SCRIPT_DIR/dist"
ZIP="$OUT/pscharts.zip"

if [ ! -f "$SRC/manifest.json" ]; then
  echo "Error: extension/manifest.json not found. Run this script from the repo root." >&2
  exit 1
fi

mkdir -p "$OUT"

# Remove previous build
[ -f "$ZIP" ] && rm "$ZIP"

# Create zip from the extension directory
(cd "$SRC" && zip -r "$ZIP" . \
  --exclude "*.DS_Store" \
  --exclude "__pycache__/*" \
  --exclude "*.pyc" \
  --exclude ".git/*")

echo "Built: $ZIP"
echo "Size:  $(du -sh "$ZIP" | cut -f1)"
