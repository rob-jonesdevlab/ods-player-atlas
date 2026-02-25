# v6-SPLASH — Plymouth + TTY Flash Fix

**Released:** 2026-02-18  
**Image:** `ods-atlas-golden-v6-SPLASH.img` (1.8G)  
**Repo:** `ods-player-os-atlas`  
**Commit:** `a4a7444` — `v5: fix TTY flash — pre-paint VT1 black before Plymouth deactivates, tight Xorg ready loop`

> **Note:** This image was originally mislabeled `ods-atlas-rpi5-golden-v5.img` due to a naming convention change. Renamed to v6-SPLASH to preserve chronological accuracy.

---

## Summary

Focused on the boot UX pipeline. Introduced the "pre-paint VT1 black" technique that eliminates the white/grey TTY flash during the Plymouth → Xorg handoff. Also introduced the new naming convention (`ods-atlas-rpi5-*`) and expanded image size to 1.8G.

## Changes from v5

### TTY Flash Elimination (Issue #2 — partial fix)
- **VT1 pre-paint:** Before Plymouth releases DRM, the script:
  1. Sets VT1 text colors to black-on-black (`setterm`)
  2. Clears screen (`printf '\033[2J'`)
  3. Suppresses console output (`printk=0`, `stty -echo`)
  4. Fills framebuffer with black pixels (`dd if=/dev/zero of=/dev/fb0`)
- **Xorg tight ready loop:** Replaced fixed `sleep 3` with 40-iteration poll (`xdpyinfo`) at 50ms intervals
- **X root window:** Painted black immediately after Xorg confirms ready (`xsetroot -solid "#000000"`)

### Plymouth Daemon Tuning (Issue #1 — partial fix)
- `plymouth deactivate` called after VT1 is black (not before)
- `plymouth quit` called only after Chromium is visible
- VT switch eliminated — X starts on VT1 directly (`Xorg :0 vt1`)

### Boot Logging
- New timestamped boot logs at `/home/signage/ODS/logs/boot/boot_*.log`
- Millisecond-precision timestamps for boot UX debugging
- Auto-cleanup of logs older than 7 days

### Naming Convention Change
- **Old:** `ods-player-os-atlas-golden-vN-TAG.img`
- **New:** `ods-atlas-rpi5-vN-TAG.img`
- Reflects transition to RPi5-specific builds

## Known Issues (carried forward)

1. Plymouth hold uses fixed `sleep 15` — too short on slow boots, too long on fast
2. Black overlay gap — brief moment between Plymouth quit and Chromium paint
3. `/player.html` still missing
4. DPMS re-enables after ~10 min (xset alone insufficient)
5. Cloud enrollment uses legacy port 9999 endpoint
