#!/usr/bin/env bash
# Download required font assets for Terroir.ma PDF generation.
# Run once after cloning: bash scripts/download-fonts.sh
#
# Fonts:
#   Amiri-Regular.ttf  — Arabic (OFL license) — https://github.com/alif-type/amiri
#   DejaVuSans.ttf     — Latin + Tifinagh (free license) — https://dejavu-fonts.github.io
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FONTS_DIR="${SCRIPT_DIR}/../assets/fonts"
mkdir -p "$FONTS_DIR"

echo "Downloading Amiri-Regular.ttf (Arabic, OFL license)..."
curl -L "https://github.com/alif-type/amiri/releases/download/0.113/amiri-0.113.zip" \
  -o /tmp/amiri.zip
unzip -o /tmp/amiri.zip "Amiri-Regular.ttf" -d "$FONTS_DIR"
rm /tmp/amiri.zip

echo "Downloading DejaVuSans.ttf (Latin + Tifinagh, free license)..."
curl -L "https://github.com/dejavu-fonts/dejavu-fonts/releases/download/version_2_37/dejavu-fonts-ttf-2.37.tar.bz2" \
  -o /tmp/dejavu.tar.bz2
tar -xjf /tmp/dejavu.tar.bz2 --strip-components=2 -C "$FONTS_DIR" \
  "dejavu-fonts-ttf-2.37/ttf/DejaVuSans.ttf"
rm /tmp/dejavu.tar.bz2

echo ""
echo "Fonts installed to $FONTS_DIR:"
ls -lh "$FONTS_DIR"/*.ttf 2>/dev/null || echo "  (none found — check curl/unzip errors above)"
