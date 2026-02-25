# v5-NATIVE — Native Kiosk Lockdown

**Released:** 2026-02-16  
**Image:** `ods-atlas-golden-v5-NATIVE.img` (1.0G)  
**Repo:** `ods-player-os-atlas`  
**Commits:** `c460e1e` → `7ac8058`

---

## Summary

Full kiosk lockdown. Disabled VT switching, masked all gettys, introduced `Ctrl+Alt+Shift+O` as the sole admin shortcut. This was the last build in the original naming convention (`ods-player-os-atlas-*`).

## Changes from v4

### VT Switching Lockdown (`c460e1e`)
- Disabled VT switch via kernel parameter `consoleblank=0`  
- All `getty@tty*.service` units masked (tty1 through tty6)
- `SysRq` key disabled (`kernel.sysrq=0` via sysctl)
- Prevents Ctrl+Alt+F1-F6 escape from kiosk

### Keyboard Shortcut System (`7ac8058`)
- `Ctrl+Alt+Shift+O` → Opens `system_config.html` (Options menu)
- All other modifier combinations blocked in JavaScript (`keydown` handler)
- Applied consistently across: `player_link.html`, `pairing.html`, `network_setup.html`, `qr.html`
- Right-click context menu blocked on all pages

### Admin Shortcut Evolution
- v4: `Ctrl+Alt+Shift+T` (admin terminal — never implemented)
- v5: Changed to `Ctrl+Alt+Shift+F5` (kiosk-safe)
- v5 final: Changed to `Ctrl+Alt+Shift+O` (O = Options)

## Known Issues (identified in field test)

1. **Plymouth timing** — splash disappears too early on slow boots
2. **White-to-grey flash** — TTY still briefly visible during Plymouth → Chromium
3. **Missing `/player.html`** — all flows redirect to a page that doesn't exist
4. **Display blanking** — screen goes black after ~10 minutes despite xset
5. **Cloud registration** — devices don't appear in ODS Cloud dashboard
