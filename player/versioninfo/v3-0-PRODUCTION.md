# v3-PRODUCTION — Production Baseline

**Released:** 2026-02-16  
**Image:** `ods-atlas-golden-v3-PRODUCTION.img` (775M)  
**Repo:** `ods-player-os-atlas`  
**Commit:** `69c7447` — `v3: Fix duplicate logs, patch cmdline.txt for RPi5 splash, mask getty@tty1`

---

## Summary

First production-intent build. Fixed RPi5-specific boot issues, kernel cmdline patching, and getty masking. Smallest image size (775M) due to aggressive cleanup.

## Changes from v2

### Boot Pipeline Fixes
- `cmdline.txt` patched with `consoleblank=0 logo.nologo loglevel=1 splash quiet plymouth.ignore-serial-consoles`
- `getty@tty1.service` masked to prevent login prompt flashing
- Duplicate systemd log output fixed

### Infrastructure
- `inject_atlas.sh` now patches boot partition `cmdline.txt` during image injection
- Boot logging streamlined (single log file, no duplicates)

### Image Optimization
- Aggressive cleanup in firstboot (removes apt cache, temp files)
- Resulted in smallest image (775M vs 1.0G)

## Known Issues

- White/grey TTY flash still visible during Plymouth → Xorg handoff
- Sleep prevention incomplete (DPMS timeout still active)
- No display orientation support
