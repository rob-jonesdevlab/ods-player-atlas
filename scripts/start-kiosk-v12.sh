#!/bin/bash
# ODS Player OS - Start Kiosk v12
# STABLE BASELINE: "boot-ux-v12-stable"
#
# SECURITY NOTE: --no-sandbox is required because Chromium runs as root.
# The proper fix is to split the kiosk service into privileged (root) and
# unprivileged (signage) phases. See .arch/boot_ux_pipeline.md for details.
#
# Chromium policy at /etc/chromium/policies/managed/ods-kiosk.json
# suppresses the security warning banner:
#   { "CommandLineFlagSecurityWarningsEnabled": false }

export DISPLAY=:0
export HOME=/home/signage

# Grant X11 access to all local users
xhost +local: 2>/dev/null || true

# Ensure Chromium profile is owned by signage
chown -R signage:signage /home/signage/.config/chromium 2>/dev/null
rm -f /home/signage/.config/chromium/SingletonLock 2>/dev/null

exec chromium --no-sandbox \
  --kiosk \
  --start-fullscreen \
  --noerrdialogs \
  --disable-infobars \
  --disable-translate \
  --no-first-run \
  --disable-features=TranslateUI \
  --disable-session-crashed-bubble \
  --disable-component-update \
  --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required \
  --force-device-scale-factor=${ODS_SCALE:-1} \
  --remote-debugging-port=9222 \
  --password-store=basic \
  --credentials-enable-service=false \
  --disable-save-password-bubble \
  --disable-autofill-keyboard-accessory-view \
  --default-background-color=000000 \
  --force-dark-mode \
  --disable-gpu-compositing \
  "http://localhost:8080/preload.html"
