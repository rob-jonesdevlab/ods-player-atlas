# ODS Player OS — Atlas

**Version:** v10-5-0-MANAGER · **Code Name:** Atlas  
**Purpose:** Dedicated player OS runtime for ODS digital signage  
**Last Updated:** March 6, 2026

---

## Overview

Atlas is the foundation release of ODS Player OS. It transforms a bare Armbian 26.2.1 (Trixie) image into a production-ready, auto-recovering kiosk that pairs with the [ODS Cloud dashboard](https://www.ods-cloud.com), displays content playlists, and provides remote management via Esper MDM and RustDesk.

The golden image is built offline on the `jdl-mini-box` build server, then flashed to SD cards. On first boot, `atlas_firstboot.sh` (systemd oneshot) converts the base Armbian into a fully provisioned player in ~15 minutes.

---

## Key Features

| Feature | Details |
|---------|---------|
| **Device Pairing** | QR code pairing with ODS Cloud dashboard |
| **Network Config** | WiFi + Ethernet setup UI (`network_setup.html`) |
| **Captive Portal** | Auto-launching setup for phone-based WiFi config (`captive_portal.html`) |
| **System Options** | On-device diagnostics panel (`system_options.html`, `Ctrl+Alt+Shift+O`) |
| **Player Ready** | Status page with glass card + wallpaper support (`player_ready.html`, `Ctrl+Alt+Shift+I`) |
| **Status Pill** | 8-stage color pill showing connection/config state on Player Ready |
| **Glass Card** | Smokey dark glass card with backdrop-filter blur when wallpaper assigned |
| **Dual-Screen** | Dynamic resolution detection, per-screen splash, auto-respawn |
| **Kiosk Mode** | Auto-recovering Chromium player (systemd restart loop) |
| **Boot UX** | Zero-flash boot: Plymouth → FBI bridge → splash → overlay → page (pre-splash modesets) |
| **Keyboard Shortcuts** | `Ctrl+Alt+Shift+I` (Info), `K` (Kill), `O` (Options), `B` (Debug) |
| **Offline Border** | Configurable animated border (6 templates, 0.450px default) |
| **VT Lockdown** | getty tty1-6 masked, SysRq disabled, VT switching blocked |
| **Sleep Prevention** | `consoleblank=0`, DPMS off, screen blanking off, suspend masked |
| **Remote Access** | RustDesk with self-hosted relay server |
| **MDM** | Esper MDM enrollment (Linux agent) |
| **Health Monitor** | Automated health checks via `ods_health_monitor.sh` |

---

## Boot UX Pipeline (v10-5-0)

The boot pipeline delivers a seamless, zero-flash experience from power-on to page-ready. All display modesets happen during black screen (before splash paint):

```
Power On
  │
  ├─ Kernel: splash quiet loglevel=3 consoleblank=0 vt.global_cursor_default=0
  │
  ├─ Plymouth ODS theme → 75-frame throbber + watermark (5s hold)
  │
  ├─ ods-player-boot-wrapper.sh starts:
  │     Stage 1: VT Blackout (tty1-3 + fb0 zero + cursor hide)
  │     Stage 2: Plymouth hold (5s) → FBI bridge "Booting system" + dots
  │     ── DISPLAY CONFIG (black screen) ──
  │     │   • Xorg start → xrdb black defaults → FBI killed
  │     │   • ods-display-config.sh (modeset) → 0.3s DRM settle
  │     │   • HDMI-2 extend if mirrored → xsetroot black
  │     │   • Compute screen metrics (SCREEN_W, ODS_SCALE)
  │     ── END DISPLAY CONFIG ──
  │     Stage 4: "Starting services" animation (stable display)
  │     Stage 5: Openbox + GTK setup
  │     Stage 6: "Launching ODS" overlay (hides Chromium init)
  │     Stage 7: Page visible → overlay killed
  │
  └─ Result: Black → ODS splash → animations → page (zero flash)
```

> See `.arch/boot_ux_pipeline.md` for full details including dual-screen support and lessons learned.

---

## Architecture

```
ods-player-atlas/
├── public/                       # Web server public directory
│   ├── network_setup.html        # Network configuration UI (default kiosk page)
│   ├── player_ready.html         # Player Ready status page (glass card + status pill)
│   ├── player_link.html          # QR code pairing flow
│   ├── captive_portal.html       # WiFi AP captive portal setup
│   ├── system_options.html       # System diagnostics panel (Ctrl+Alt+Shift+O)
│   ├── player_registration.html            # Enrollment status
│   ├── loader.html               # Boot loader screen
│   └── resources/
│       └── designs/
│           └── ODS_Background.png  # Default wallpaper for glass card
├── server.js                     # Express orchestrator (195 lines, mounts route modules)
├── routes/                       # Modular Express routers (4 domain modules)
│   ├── system.js                 # /api/system/* — info, actions, logs, volume, timezone
│   ├── admin.js                  # /api/admin/*  — auth, terminal, SSH, password, services
│   ├── network.js                # /api/*        — status, WiFi, display, static IP
│   └── content.js                # /api/*        — cache, player content, device info, cloud sync
├── player/                       # Player runtime modules
│   ├── cloud-sync.js             # WebSocket sync + content polling
│   └── cache-manager.js          # Offline cache management + manifest
├── package.json                  # Node.js dependencies
├── VERSION                       # Current version ("v10-5-0-MANAGER")
├── bin/
│   └── ods_health_monitor.sh     # Health monitoring script
├── brand/
│   └── splash/                   # Plymouth theme assets + generated frames
├── scripts/
│   ├── inject_atlas.sh           # Golden image builder (loop-mount + inject)
│   ├── atlas_firstboot.sh        # 11-step automated first boot (~1400 lines)
│   ├── atlas-firstboot.service   # systemd oneshot service
│   ├── ods-player-boot-wrapper.sh # Boot pipeline orchestrator
│   ├── start-player-os-ATLAS.sh  # Chromium --app mode launcher
│   ├── ods-phase-selector.sh     # Phase 2 (enrollment) vs Phase 3 (production)
│   ├── ods-enrollment-boot.sh    # Phase 2 enrollment boot
│   ├── ods-setup-ap.sh           # WiFi AP management
│   ├── generate_splash_frames.sh # Regenerates all splash PNGs
│   └── atlas_secrets.conf        # Credentials (checked into private repo)
├── .arch/
│   ├── project.md                # Full architecture documentation
│   ├── boot_ux_pipeline.md       # Boot UX pipeline documentation
│   ├── build_guide.md            # Golden image build guide
│   ├── image_processes.md        # Phase 0/1/2 image lifecycle
│   └── api_doc.md                # API documentation (43 endpoints)
└── README.md
```

---

## Golden Image Build Process

### Prerequisites

- **Build server:** `jdl-mini-box` (Ubuntu, IP `10.111.123.134`)
- **Base image:** `Armbian_26.2.1_Rpi4b_trixie_current_6.18.9_minimal.img`
- **Credentials:** `atlas_secrets.conf` with GitHub token, Esper keys, RustDesk config

### Build Command

```bash
# SSH to build server
ssh jones-dev-lab@10.111.123.134

# Setup sudo access (SUDO_ASKPASS required over SSH)
cat > /tmp/askpass.sh << "EOF"
#!/bin/bash
echo "your-password"
EOF
chmod +x /tmp/askpass.sh
export SUDO_ASKPASS=/tmp/askpass.sh

# Update scripts from GitHub
cd ~/atlas-build
sudo -A rm -f ods-atlas-rpi5-golden-v5.img
git -C scripts-repo pull  # or re-clone

# Build with explicit paths (sudo changes $HOME)
sudo -A bash scripts/inject_atlas.sh \
  /home/jones-dev-lab/atlas-build/Armbian_26.2.1_Rpi4b_trixie_current_6.18.9_minimal.img \
  /home/jones-dev-lab/atlas-build/ods-atlas-rpi5-golden-v5.img

# Copy to Mac
scp jones-dev-lab@10.111.123.134:~/atlas-build/ods-atlas-rpi5-golden-v5.img ~/Desktop/
```

### What `inject_atlas.sh` Does

1. Copies base Armbian image → output image
2. Loop-mounts the image (`losetup --partscan`)
3. Checks filesystem (`e2fsck`)
4. Mounts rootfs (partition 2)
5. Injects: `atlas_firstboot.sh`, `atlas-firstboot.service`, `atlas_secrets.conf`
6. Enables firstboot service at `multi-user.target`
7. Patches boot partition `cmdline.txt` (consoleblank, splash, cursor, loglevel)
8. Unmounts and produces output image (~1.8 GB)

### What `atlas_firstboot.sh` Does (11 Steps)

| Step | Action | Key Details |
|------|--------|-------------|
| 1 | Bypass Armbian first-login | Set root password, disable firstlogin service |
| 2 | Install packages | chromium, xorg, matchbox, plymouth, nodejs, npm, git |
| 3 | Create users | `signage` (kiosk, no password), `otter` (admin, sudo) |
| 4 | Clone & deploy Atlas | Git clone → `/home/signage/ODS/`, npm install |
| 5 | Deploy systemd services | 6 services: kiosk, webserver, health monitor, plymouth-hold, hide-tty, shutdown-splash |
| 6 | Deploy kiosk scripts | `start-kiosk.sh`, `ods-kiosk-wrapper.sh` (with TTY flash fix), `hide-tty.sh` |
| 7 | Install Plymouth theme | ODS branded splash, `two-step` module, bold fonts, black background |
| 8 | Configure boot params | VT lockdown (Xorg `DontVTSwitch`, getty mask, SysRq disable), sleep prevention, kernel cmdline patches |
| 9 | Enroll Esper MDM | Download + run Esper Linux agent setup |
| 10 | Install RustDesk | ARM64 .deb, self-hosted relay config, systemd service |
| 11 | Finalize | Disable firstboot service, copy logs, reboot to production |

---

## Systemd Services (Production)

| Service | Purpose | Type |
|---------|---------|------|
| `ods-player-ATLAS.service` | Boot wrapper + X11 + Chromium player | simple, restart=always |
| `ods-webserver.service` | Node.js Express server (port 8080) | simple, User=signage |
| `ods-health-monitor.service` | Automated health checks | simple, restart=always |
| `ods-plymouth-hold.service` | Hold Plymouth splash until player starts | oneshot |
| `ods-hide-tty.service` | Suppress TTY1 text output | oneshot |
| `ods-shutdown-splash.service` | Show Plymouth on reboot/shutdown | oneshot |
| `ods-rustdesk-enterprise.service` | RustDesk remote access | simple, restart=always |

---

## Server API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/status` | Network + device status (hostname, WiFi, Ethernet) |
| POST | `/api/wifi/configure` | Configure WiFi (SSID + password) |
| GET | `/api/qr` | Generate setup QR code |
| POST | `/api/enroll` | Trigger device enrollment |
| GET | `/api/loader-ready` | Signal boot loader is ready |
| GET | `/api/system/info` | System diagnostics |
| POST | `/api/system/restart-signage` | Kill/restart Chromium (Ctrl+Alt+Shift+K) |
| POST | `/api/system/reboot` | Reboot device |
| POST | `/api/system/shutdown` | Shutdown device |
| POST | `/api/system/cache-clear` | Clear Chromium cache |
| POST | `/api/system/factory-reset` | Factory reset (wipe + reboot) |
| GET | `/api/system/logs` | View system logs |

> See `.arch/api_doc.md` for all 43 endpoints.

---

## File Locations (on device)

| Component | Path |
|-----------|------|
| Player Runtime | `/home/signage/ODS/` |
| Public Files | `/home/signage/ODS/public/` |
| Server | `/home/signage/ODS/server.js` |
| Health Monitor | `/home/signage/ODS/bin/ods_health_monitor.sh` |
| Boot Logs | `/home/signage/ODS/logs/boot/` |
| Boot Wrapper | `/usr/local/bin/ods-player-boot-wrapper.sh` |
| Chromium Launcher | `/usr/local/bin/start-player-ATLAS.sh` |
| Phase Selector | `/usr/local/bin/ods-phase-selector.sh` |
| Display Config | `/usr/local/bin/ods-display-config.sh` |
| Plymouth Theme | `/usr/share/plymouth/themes/ods/` |
| Xorg No-VT Config | `/etc/X11/xorg.conf.d/10-no-vtswitch.conf` |
| Secrets | `/usr/local/etc/atlas_secrets.conf` (chmod 600) |

---

## Version History

| Version | Date | Key Changes |
|---------|------|-------------|
| v1–v6 | Feb 16-18, 2026 | Foundation: firstboot, lockdown, Plymouth, services |
| v7 | Feb 21-22, 2026 | Openbox WM, `--app` mode, FBI bridge, overlay approach |
| v8 | Feb 22-23, 2026 | Premium boot UX: 4K splash, 5-frame animations, enrollment |
| v9.0 | Feb 24, 2026 | Major: player naming convention, consolidated assets |
| v9.1 | Feb 26, 2026 | 7 root cause fixes (gate file, apt batching, resize) |
| v9.2-9.3 | Feb 27-28, 2026 | WiFi AP, captive portal, glass card, status pill, shortcuts |
| v10.1 | Mar 1, 2026 | Modularization (4 route modules), 78/78 tests, content delivery |
| v10.2-10.3 | Mar 2, 2026 | Boot stability: rollback to `e417033`, explicit `--mode 1920x1080` |
| v10.4 | Mar 3, 2026 | Dynamic resolution, Screen 1 watermark, auto-respawn, 429 backoff |
| **v10.5** | **Mar 6, 2026** | **Zero-flash boot: pre-splash modesets, DRM settle, HDMI-2 fix** |

---

## Known Issues & Gotchas

| Issue | Details | Status |
|-------|---------|--------|
| `sudo -S` over SSH hangs | Use `SUDO_ASKPASS` with `-A` flag instead | ✅ Workaround |
| `inject_atlas.sh` path with sudo | Pass explicit paths as args (sudo sets `$HOME=/root`) | ✅ Fixed |
| `xrandr --preferred` flash | Triggers DRM mode switch on 4K displays — use explicit `--mode` | ✅ Fixed v10.3 |
| Runtime `convert -resize` during boot | Too heavy for Pi CPU — use pre-baked assets | ✅ Fixed v10.3 |
| Display modesets during splash | DRM blanks cause animation gaps — move to pre-splash | ✅ Fixed v10.5 |
| "Baked" scripts don't revert with git | Verify `/usr/local/bin/` scripts after code changes | ⚠️ By design |

---

## Next Steps

- [ ] P:0 golden image rebuild → **v10-5-0-MANAGER**
- [ ] ODS Cloud — Content delivery pipeline
- [ ] ODS Cloud — Player Settings UI
- [ ] OTA updates from ODS Cloud dashboard

---

## Development

### Local Testing

```bash
npm install
npm start
# Access: http://localhost:8080/network_setup.html
# Access: http://localhost:8080/system_options.html
# Access: http://localhost:8080/player_ready.html
```

### Deploy Changes to Device

> **Always use `sshpass` for SSH/SCP** to provide passwords inline. Never rely on interactive password prompts.

```bash
# Deploy HTML files
sshpass -p '0D5@dm!n' scp -o StrictHostKeyChecking=no public/*.html root@10.111.123.102:/home/signage/ODS/public/

# Deploy server + route modules
sshpass -p '0D5@dm!n' scp -o StrictHostKeyChecking=no server.js root@10.111.123.102:/home/signage/ODS/
sshpass -p '0D5@dm!n' scp -r -o StrictHostKeyChecking=no routes/ root@10.111.123.102:/home/signage/ODS/

# Deploy player modules
sshpass -p '0D5@dm!n' scp -o StrictHostKeyChecking=no player/*.js root@10.111.123.102:/home/signage/ODS/player/

# Deploy boot script (lives at /usr/local/bin/ on device, not /home/signage/ODS/scripts/)
sshpass -p '0D5@dm!n' scp -o StrictHostKeyChecking=no scripts/start-player-ATLAS.sh root@10.111.123.102:/usr/local/bin/

# Restart webserver
sshpass -p '0D5@dm!n' ssh -o StrictHostKeyChecking=no root@10.111.123.102 'systemctl restart ods-webserver'
```

### Troubleshooting

| Problem | Check |
|---------|-------|
| No display | `systemctl status ods-kiosk`, `journalctl -u ods-kiosk` |
| Server not running | `systemctl status ods-webserver` |
| Boot logs | `ls -la /home/signage/ODS/logs/boot/` |
| White flash on boot | Verify `ods-kiosk-wrapper.sh` has TTY FLASH FIX section |
| VT switching works | Verify `10-no-vtswitch.conf` exists and getty@tty* are masked |

---

## License

Copyright © 2026 ODS Cloud. All rights reserved.
