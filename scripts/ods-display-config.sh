#!/bin/bash
# ODS Display Configuration — reads layout JSON, applies xrandr
export DISPLAY=:0
CONFIG_DIR="/home/signage/ODS/config/layout"
CURRENT_MODE=$(cat "$CONFIG_DIR/.current_mode" 2>/dev/null || echo "single_hd_landscape")

CONFIG_FILE="$CONFIG_DIR/ods_mode_${CURRENT_MODE}.json"
if [ ! -f "$CONFIG_FILE" ]; then
    echo "[DISPLAY] No config for mode $CURRENT_MODE, defaulting to single screen"
    exit 0
fi

# Read orientation from config
ORIENTATION=$(jq -r '.monitor_config.orientation // "landscape"' "$CONFIG_FILE")
NUM_SCREENS=$(jq -r '.windows | length' "$CONFIG_FILE")

echo "[DISPLAY] Mode: $CURRENT_MODE, Orientation: $ORIENTATION, Screens: $NUM_SCREENS"

# Apply xrandr based on config
case "$ORIENTATION" in
    portrait)
        xrandr --output HDMI-1 --mode 1920x1080 --rotate left 2>/dev/null || true
        if [ "$NUM_SCREENS" -ge 2 ]; then
            xrandr --output HDMI-2 --mode 1920x1080 --rotate left --right-of HDMI-1 2>/dev/null || true
        fi
        ;;
    landscape|*)
        xrandr --output HDMI-1 --mode 1920x1080 --rotate normal 2>/dev/null || true
        if [ "$NUM_SCREENS" -ge 2 ]; then
            xrandr --output HDMI-2 --mode 1920x1080 --rotate normal --right-of HDMI-1 2>/dev/null || true
        fi
        ;;
esac
echo "[DISPLAY] xrandr configuration applied"
