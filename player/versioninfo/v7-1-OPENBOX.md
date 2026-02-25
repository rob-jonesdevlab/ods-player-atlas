# v7-1-OPENBOX — Field Test Fixes

**Released:** 2026-02-21  
**Image:** `ods-atlas-golden-v7-1-OPENBOX.img` (1.8G)  
**Repo:** `ods-player-os-atlas`  
**Commit:** `11b3256` — `fix(v7.1): 5 field test fixes — splash timing, 4K scaling, TTY flash, transition order, admin UI`  
**Patch of:** v7-0-OPENBOX

---

## Summary

Patch release addressing all 5 issues found during v7-0 field test on 4K display connected to ArPi5.

## Fixes

### Fix 1: Plymouth Splash Too Short + Long Black Screen
- **Root cause:** Plymouth readiness signal (`/tmp/ods-kiosk-starting`) was sent at wrapper start, before X was running. Splash released too early → long black screen while X initializes.
- **Fix:** Moved `touch /tmp/ods-kiosk-starting` to **after** `xdpyinfo` confirms X is ready.
- **File:** `scripts/atlas_firstboot.sh` (kiosk wrapper, line ~485)

### Fix 2: Splash Assets Too Small on 4K
- **Root cause:** Plymouth assets designed for 1080p. On 4K (3840×2160), assets render at native pixel size = too small.
- **Fix:** Added `imagemagick` package. `deploy_plymouth()` now scales assets:
  - `watermark.png` → 200%
  - `bgrt-fallback.png` → 135%
  - `throbber-*.png` frames → 80%
- **File:** `scripts/atlas_firstboot.sh` (deploy_plymouth, line ~734)
- **New package:** `imagemagick`

### Fix 3: TTY Still Briefly Visible
- **Root cause:** Single framebuffer fill pass insufficient on some hardware timing.
- **Fix:** Double-pass framebuffer fill (`dd` 256 blocks × 2 passes), plus global VT cursor hide (`\033[?25l`).
- **File:** `scripts/atlas_firstboot.sh` (kiosk wrapper, line ~467)

### Fix 4: White → Grey Flash Before OS
- **Root cause:** Plymouth quit happened **after** black overlay was killed → exposed raw VT1 between overlay removal and Chromium visibility.
- **Fix:** **Restructured transition order:**
  1. Black overlay launched + raised via `xdotool`
  2. **Plymouth quit while overlay covers screen** ← key change
  3. Openbox + Chromium start behind overlay
  4. Overlay killed after Chromium signals page-ready
- **File:** `scripts/atlas_firstboot.sh` (kiosk wrapper, lines ~505-515)

### Fix 5: Admin Username Pre-populated
- **Issue:** Username field showed "otter" as readonly — both fields should start empty.
- **Fix:** Removed `value="otter"` and `readonly` attribute. Both fields now have placeholder text.
- **File:** `public/system_config.html` (line ~508)

## Files Changed

| File | Changes |
|------|---------|
| `scripts/atlas_firstboot.sh` | Fixes #1-4: wrapper v7, imagemagick, strengthened VT1, transition reorder |
| `public/system_config.html` | Fix #5: admin username empty |
