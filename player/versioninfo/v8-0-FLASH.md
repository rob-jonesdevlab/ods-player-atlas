# v8-0 FLASH — Boot UX Sprint

**Date Range:** February 21-22, 2026  
**Images:** v8-1-0-FLASH  
**Codename:** FLASH

---

## Overview

The v8 FLASH series eliminated all visual artifacts during the boot-to-player transition: Plymouth holdback, FBI framebuffer bridge, grey flash fix via overlay window, TTY blackout, and cursor hiding.

## Key Changes

| Area | Change |
|------|--------|
| Plymouth hold | `ods-plymouth-hold.service` blocks `plymouth-quit` until player ready |
| FBI bridge | Framebuffer image bridge between Plymouth and Xorg (`ods-fbi.service`) |
| Grey flash fix | Overlay window covers Chromium compositor surface during startup |
| TTY blackout | tty1-6 pre-painted black, framebuffer cleared, kernel printk silenced |
| Cursor hiding | `unclutter` + CSS `cursor: none` on all pages |
| 4K Plymouth | 3840×2160 watermark, transparent bgrt-fallback, `.90` throbber alignment |
| VT lockdown | `DontVTSwitch` in xorg.conf, getty tty1-6 masked, SysRq disabled |

## Architecture

```
Plymouth (animated splash)
    → ods-plymouth-hold.service (holds quit)
    → FBI (framebuffer image bridge)
    → Openbox + Xorg
    → Overlay window (hides grey flash)
    → Chromium --app (player page)
    → Plymouth releases
```
