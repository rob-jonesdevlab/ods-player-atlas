# v1-INITIAL — First Boot

**Released:** 2026-02-16  
**Image:** `ods-atlas-golden-v1-INITIAL.img` (1.0G)  
**Repo:** `ods-player-os-atlas`  
**Commit:** `3e072c7` — `feat: initial Atlas release`

---

## Summary

First working golden image. Established the foundational architecture:
Armbian base → firstboot service → package install → user creation → kiosk deployment.

## Architecture

| Component | Implementation |
|-----------|---------------|
| Base OS | Armbian Trixie (Debian 13), kernel 6.18.9 |
| Display Server | Xorg on VT1 |
| Window Manager | `matchbox-window-manager` (single-window, no titlebar) |
| Browser | Chromium (kiosk mode, `--app` flag) |
| Web Server | Node.js Express on port 8080 |
| Users | `root`, `signage` (kiosk autologin) |

## Key Changes

- `atlas_firstboot.sh` — automated provisioning script (runs once on first boot)
- `inject_atlas.sh` — image injection script (mounts .img, injects scripts)
- `atlas-firstboot.service` — systemd oneshot to trigger firstboot
- `atlas_secrets.conf` — credential store (not in git)
- Express server serving HTML pages: `network_setup.html`, `pairing.html`, `qr.html`
- Chromium launched via `start-kiosk.sh` (fullscreen, `--kiosk` flag)
- Basic network configuration UI (WiFi SSID/password)

## Known Issues

- No boot splash (raw console text visible during boot)
- No sleep prevention (display blanks after idle timeout)
- No keyboard lockdown (all shortcuts accessible)
- Plymouth not configured
