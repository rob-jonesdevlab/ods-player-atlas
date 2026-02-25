# v2-SECURE — Security Hardening

**Released:** 2026-02-16  
**Image:** `ods-atlas-golden-v2-SECURE.img` (1.0G)  
**Repo:** `ods-player-os-atlas`  
**Commits:** `cf392ed` → `2ea1bdd`

---

## Summary

Security pass over v1. Added Plymouth boot splash branding, cursor hiding, and initial kiosk lockdown measures.

## Changes from v1

### Plymouth Boot Splash
- Installed `plymouth` and `plymouth-themes`
- Created ODS-branded splash screen assets
- Multiple iterations on splash vertical alignment (`2ea1bdd`, `603a4ad`, `be03329`, `d5bc314`, `7356e44`, `5c682fd`)

### Kiosk Hardening
- `unclutter` added for cursor hiding
- Chromium launched with `--disable-translate --disable-features=TranslateUI`
- Right-click context menu blocked in all HTML pages

### UI Sync
- Player pages synced from `ods-signage` dashboard designs
- `player_link.html` added (device linking flow)

## Known Issues

- Plymouth splash alignment inconsistent across resolutions
- No VT switching lockdown
- TTY text flash visible during Plymouth → Xorg transition
