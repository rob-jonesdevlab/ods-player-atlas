#!/bin/bash
# ODS Kiosk Wrapper v12 — Clean rebuild
# Pipeline: Plymouth (5s) → Starting ODS services (1.5s) → Launching OS (until ready) → Page visible
# STABLE BASELINE: "boot-ux-v12-stable" — the premium product boot sequence
# DO NOT add set -e — non-zero exits from display/xrandr will kill the wrapper

LOG_DIR="/home/signage/ODS/logs/boot"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/boot_$(date +%Y%m%d_%H%M%S).log"
log() { echo "$(date '+%Y-%m-%d %H:%M:%S.%3N') [WRAPPER] $1" | tee -a "$LOG_FILE"; }

# ── STAGE 1: VT BLACKOUT ─────────────────────────────────────────────
log "Starting ODS kiosk wrapper v12..."

# Wait for DRM device
for i in $(seq 1 30); do [ -e /dev/dri/card1 ] && break; sleep 0.1; done
log "DRM device ready"

# Black out VT
for tty in /dev/tty1 /dev/tty2 /dev/tty3; do
    printf '\033[2J\033[H\033[?25l' > "$tty" 2>/dev/null || true
    setterm --foreground black --background black --cursor off > "$tty" 2>/dev/null || true
done
dd if=/dev/zero of=/dev/fb0 bs=65536 count=512 conv=notrunc 2>/dev/null || true
log "VT blackout complete"

# ── STAGE 2: PLYMOUTH (hold 5s then quit) ─────────────────────────────
dmesg -D 2>/dev/null || true
echo 0 > /proc/sys/kernel/printk 2>/dev/null || true
touch /tmp/ods-kiosk-starting
sleep 5
plymouth quit --retain-splash 2>/dev/null || true
log "Plymouth quit (held 5s)"
dd if=/dev/zero of=/dev/fb0 bs=65536 count=512 conv=notrunc 2>/dev/null || true

# ── STAGE 3: XORG ────────────────────────────────────────────────────
export HOME=/home/signage
export DISPLAY=:0
Xorg :0 -nolisten tcp -novtswitch vt1 -br &
for i in $(seq 1 120); do
    xdpyinfo -display :0 >/dev/null 2>&1 && break
    sleep 0.05
done
xhost +local: 2>/dev/null || true
log "Xorg ready"

# ── SPLASH PHASE 1: Starting ODS services (1.5s) ─────────────────────
ANIM_DIR=/usr/share/plymouth/themes/ods
for _f in 1 2 3 4 5; do
    DISPLAY=:0 display -window root "$ANIM_DIR/splash_ods_${_f}.png" 2>/dev/null
    sleep 0.3
done
log "Splash: Starting ODS services complete"

# ── STAGE 4: WINDOW MANAGER + CONFIG ─────────────────────────────────
xset -dpms 2>/dev/null || true
xset s off 2>/dev/null || true
xset s noblank 2>/dev/null || true
openbox --config-file /etc/ods/openbox-rc.xml &
unclutter -idle 0.01 -root &
sleep 0.5
/usr/local/bin/ods-display-config.sh 2>/dev/null || true
log "Openbox started"

# Detect screen resolution
SCREEN_W=$(xrandr 2>/dev/null | grep '*' | head -1 | awk '{print $1}' | cut -dx -f1)
[ -z "$SCREEN_W" ] || [ "$SCREEN_W" -eq 0 ] 2>/dev/null && SCREEN_W=1920
if [ "$SCREEN_W" -ge 3000 ]; then
    export ODS_SCALE=2
elif [ "$SCREEN_W" -ge 2000 ]; then
    export ODS_SCALE=1.5
else
    export ODS_SCALE=1
fi
log "Screen: ${SCREEN_W}px, Scale: ${ODS_SCALE}"

# Dark GTK theme
export GTK_THEME="Adwaita:dark"
export GTK2_RC_FILES="/usr/share/themes/Adwaita-dark/gtk-2.0/gtkrc"
mkdir -p /home/signage/.config/gtk-3.0
cat > /home/signage/.config/gtk-3.0/settings.ini << 'GTK'
[Settings]
gtk-application-prefer-dark-theme=1
gtk-theme-name=Adwaita-dark
GTK
log "Dark GTK theme set"

# ── SPLASH PHASE 2: Launching OS (animated until ready) ──────────────
# Clean up stale signal
rm -f /tmp/ods-loader-ready

# Launch Chromium (on-screen, kiosk mode)
/usr/local/bin/start-kiosk.sh &
KIOSK_PID=$!
log "Chromium launched (PID: $KIOSK_PID)"

# Animated "Launching OS" loop on root window until page ready
(
    while [ ! -f /tmp/ods-loader-ready ]; do
        for _d in 1 2 3 4 5; do
            [ -f /tmp/ods-loader-ready ] && break 2
            DISPLAY=:0 display -window root "$ANIM_DIR/splash_launch_${_d}.png" 2>/dev/null
            sleep 0.3
        done
    done
) &
ANIM_PID=$!
log "Launching OS animation started"

# ── STAGE 5: WAIT FOR PAGE READY ─────────────────────────────────────
TIMEOUT=60
ELAPSED=0
log "Waiting for page ready signal..."

while [ ! -f /tmp/ods-loader-ready ]; do
    sleep 0.5
    ELAPSED=$((ELAPSED + 1))
    if [ $ELAPSED -ge $((TIMEOUT * 2)) ]; then
        log "WARN: Page ready not received after ${TIMEOUT}s"
        break
    fi
done

[ -f /tmp/ods-loader-ready ] && log "Page ready signal received"

# Kill animation loop
kill $ANIM_PID 2>/dev/null || true

# ── STAGE 6: PLYMOUTH QUIT & CLEANUP ─────────────────────────────────
plymouth quit 2>/dev/null || true
log "Boot pipeline complete."

# Cleanup
rm -f /tmp/ods-kiosk-starting /tmp/ods-loader-ready
find "$LOG_DIR" -name "boot_*.log" -type f -mtime +7 -delete 2>/dev/null || true

# Wait for kiosk process
wait $KIOSK_PID 2>/dev/null
log "Kiosk process exited"
