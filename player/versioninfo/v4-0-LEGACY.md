# v4-LEGACY — Forensic Sync + White Flash Fix

**Released:** 2026-02-16  
**Image:** `ods-atlas-golden-v4-LEGACY.img` (1.0G)  
**Repo:** `ods-player-os-atlas`  
**Commits:** `a632f38` → `5eebc59`

---

## Summary

Forensic sync with production ArPi5 device state. Applied 4 post-flash fixes discovered during field observation. First attempt at white flash elimination and sleep prevention.

## Changes from v3

### Forensic Sync (`a632f38`)
- Aligned repo with actual ArPi5 production state
- Resolved divergence between git and deployed code

### White Flash Fix (`5eebc59`)
- Plymouth splash timing adjusted
- Initial sleep prevention layer (screen blanking disabled via `xset`)
- Font rendering improvements

### Sleep Prevention (Layer 1)
- `xset -dpms` after Xorg starts
- `xset s off` and `xset s noblank`
- Chromium flag `--disable-features=IdleDetection`

### Plymouth Improvements
- Custom ODS theme installed during firstboot
- `ShowDelay=0` to prevent intermediate blank

## Known Issues

- VT switching still possible (Ctrl+Alt+F2 escapes kiosk)
- White TTY flash reduced but not eliminated
- No keyboard shortcut lockdown beyond basic Chromium flags
