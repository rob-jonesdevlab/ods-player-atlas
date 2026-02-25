#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# generate_splash_frames.sh — Regenerate all boot splash PNGs
# ODS Player OS Atlas v8-3-1
#
# PURPOSE: Fix text centering — center on WORDS, dots trail right
#          (Previously, center-gravity on full string caused text shift)
#
# REQUIRES: ImageMagick 6/7, DejaVu Sans Mono font
# RUN ON:   jdl-mini-box (Linux build machine)
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── CONFIG ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
ASSET_DIR="${REPO_DIR}/brand/splash/generated"
BASE_IMG="${ASSET_DIR}/watermark.png"
OUTPUT_DIR="${ASSET_DIR}"

WIDTH=3840
HEIGHT=2160
FONT="DejaVu-Sans-Mono"
FONT_SIZE=42
TEXT_COLOR="white"
TEXT_Y=2050    # Y position for status text (near bottom of 2160px canvas)

# ── VALIDATION ────────────────────────────────────────────────────────
if [ ! -f "$BASE_IMG" ]; then
    echo "ERROR: Base image not found: $BASE_IMG"
    exit 1
fi

if ! command -v convert &>/dev/null; then
    echo "ERROR: ImageMagick not found. Install with: sudo apt install imagemagick"
    exit 1
fi

echo "═══════════════════════════════════════════════════"
echo " ODS Splash Frame Generator"
echo " Base: $BASE_IMG"
echo " Output: $OUTPUT_DIR"
echo "═══════════════════════════════════════════════════"

# ── FUNCTION: Generate a set of dot-animated frames ───────────────────
# Draws the base text centered, then appends dots to the right
# This keeps the text position FIXED across all 5 frames
#
# Usage: generate_dot_frames "prefix" "Base text" max_dots
#   prefix:   output filename prefix (e.g. "fbi_boot")
#   text:     the status message WITHOUT dots (e.g. "Booting system")
#   max_dots: number of frames/dots (typically 5)

generate_dot_frames() {
    local prefix="$1"
    local base_text="$2"
    local max_dots="${3:-5}"

    echo ""
    echo "── Generating: ${prefix}_1..${max_dots}.png"
    echo "   Text: \"${base_text}\" + trailing dots"

    # Measure the pixel width of the base text (without dots)
    local text_width
    text_width=$(convert -font "$FONT" -pointsize "$FONT_SIZE" \
        label:"${base_text}" -format "%w" info: 2>/dev/null)

    # Calculate X position to center the base text horizontally
    local text_x=$(( (WIDTH - text_width) / 2 ))

    echo "   Base text width: ${text_width}px, X offset: ${text_x}px"

    for i in $(seq 1 "$max_dots"); do
        local dots=""
        for d in $(seq 1 "$i"); do
            dots="${dots}."
        done

        local full_text="${base_text}${dots}"
        local out_file="${OUTPUT_DIR}/${prefix}_${i}.png"

        # Draw the full text at exact X position (left-justified at calculated center)
        convert "$BASE_IMG" \
            -font "$FONT" -pointsize "$FONT_SIZE" -fill "$TEXT_COLOR" \
            -gravity NorthWest \
            -annotate "+${text_x}+${TEXT_Y}" "${full_text}" \
            "$out_file"

        echo "   ✓ ${prefix}_${i}.png → \"${full_text}\""
    done
}

# ── FUNCTION: Generate a single static frame ──────────────────────────
# Draws centered text (no dot animation)
#
# Usage: generate_static_frame "filename" "Text message"

generate_static_frame() {
    local filename="$1"
    local text="$2"
    local out_file="${OUTPUT_DIR}/${filename}"

    echo ""
    echo "── Generating: ${filename}"
    echo "   Text: \"${text}\" (static, centered)"

    convert "$BASE_IMG" \
        -font "$FONT" -pointsize "$FONT_SIZE" -fill "$TEXT_COLOR" \
        -gravity South \
        -annotate "+0+$(( HEIGHT - TEXT_Y ))" "${text}" \
        "$out_file"

    echo "   ✓ ${filename}"
}

# ═══════════════════════════════════════════════════════════════════════
# GENERATE ALL FRAMES
# ═══════════════════════════════════════════════════════════════════════

# 1. FBI Boot bridge animation (framebuffer, pre-Xorg)
#    "Booting system." → "Booting system....."
generate_dot_frames "fbi_boot" "Booting system" 5

# 2. Splash ODS (X11 root window, "Starting services" animation)
#    "Starting services." → "Starting services....."
generate_dot_frames "splash_ods" "Starting services" 5

# 3. Overlay launch (X11 overlay window, "Launching ODS" animation)
#    "Launching ODS." → "Launching ODS....."
generate_dot_frames "overlay_launch" "Launching ODS" 5

# 4. Splash launch (alternative naming — same content as overlay_launch)
#    Some scripts reference splash_launch_N instead of overlay_launch_N
generate_dot_frames "splash_launch" "Launching ODS" 5

# 5. Static: "Starting..." (Plymouth transition frame)
generate_static_frame "splash_starting.png" "Starting..."

# 6. Static: "Boot complete" (final frame before page reveal)
generate_static_frame "splash_boot_complete.png" "Boot complete"

# 7. Static: "Starting ODS services" (transitional anim frame)
generate_static_frame "splash_anim1.png" "Starting ODS services"

echo ""
echo "═══════════════════════════════════════════════════"
echo " ✓ All splash frames generated"
echo "   Output: ${OUTPUT_DIR}"
echo ""
echo " Next steps:"
echo "   1. Review generated PNGs visually"
echo "   2. Commit to repo"
echo "   3. SCP to device: /usr/share/plymouth/themes/ods/"
echo "   4. Convert fbi_boot PNGs to raw RGB565:"
echo "      for f in fbi_boot_{1..5}.png; do"
echo "        convert \$f -depth 8 -resize 1920x1080 rgb:- | \\"
echo "          python3 -c 'import sys; d=sys.stdin.buffer.read(); o=bytearray()"
echo "          for i in range(0,len(d),3): r,g,b=d[i],d[i+1],d[i+2]; o+=((r>>3<<11)|(g>>2<<5)|(b>>3)).to_bytes(2,\"little\")"
echo "          sys.stdout.buffer.write(o)' > /usr/share/plymouth/themes/ods/\${f%.png}.raw"
echo "      done"
echo "═══════════════════════════════════════════════════"
