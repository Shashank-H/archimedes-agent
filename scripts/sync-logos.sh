#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR/logos"
TARGET_DIR="$ROOT_DIR/public/logos"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Missing source directory: $SOURCE_DIR" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"

shopt -s nullglob
copied=0
for file in "$SOURCE_DIR"/*.{png,svg,jpg,jpeg,webp,ico}; do
  [[ -f "$file" ]] || continue
  cp "$file" "$TARGET_DIR/"
  echo "- $(basename "$file")"
  copied=$((copied + 1))
done
shopt -u nullglob

if [[ "$copied" -eq 0 ]]; then
  echo "No logo assets found in $SOURCE_DIR" >&2
else
  echo "Synced $copied logo asset(s) to public/logos"
fi
