# ODS Player Atlas — Architecture

**Last Updated:** March 6, 2026  
**Current Version:** v10-5-0-MANAGER  
**Status:** Production-ready P:0 → P:3 pipeline — Zero-flash boot (pre-splash modesets), dual-screen support, modular server architecture, WiFi AP/captive portal, glass card + wallpaper, status pill, keyboard shortcuts

---

## System Overview

ODS Player OS Atlas converts a Raspberry Pi 4b running Armbian into a locked-down digital signage player. The system operates as a three-layer stack:

```
┌─────────────────────────────────────────────────┐
│ ODS Cloud Dashboard (ods-cloud-amigo)            │
│ → Playlist management, content upload, pairing  │
│ → https://www.ods-cloud.com                     │
├─────────────────────────────────────────────────┤
│ ODS Player Atlas (this repo)                    │
│ → Express server (port 8080) — modular routes   │
│ → routes/system.js, admin.js, network.js,       │
│   content.js (4 domain routers)                 │
│ → Chromium --app mode (X11 fullscreen)          │
│ → systemd services (12 production services)     │
│ → Boot UX pipeline (Plymouth → FBI → Xorg)     │
├─────────────────────────────────────────────────┤
│ Armbian 26.2.1 Trixie (RPi4b)                  │
│ → Linux 6.18.9, ext4, systemd                  │
│ → DRM/KMS display, Plymouth boot splash         │
│ → Debian Trixie (Python 3.13, yescrypt hashes)  │
└─────────────────────────────────────────────────┘
```

## Build Pipeline (P:0 → P:3)

Golden images are built via **inject + firstboot**, not by cloning the dev device:

```
P:0 (Insert)         P:1 (Clone)          P:2 (Enrollment)     P:3 (Production)
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Base Armbian  │    │ Provisioned  │    │ Enrollment   │    │ Production   │
│ + firstboot   │───▶│ golden image │───▶│ sealed splash│───▶│ Player OS    │
│ inject_atlas  │    │ partclone    │    │ mgmt server  │    │ full boot    │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

**P:0:** `inject_atlas.sh` loop-mounts base Armbian, injects firstboot + service + secrets  
**P:1:** `partclone` snapshot of provisioned device (safety net)  
**P:2:** Enrollment boot — connects to Esper MDM (no Chromium/Xorg)  
**P:3:** Production boot — full premium boot pipeline with Chromium  

> **Goal:** Make P:0 as close to P:3 as possible. Every feature must be captured in `atlas_firstboot.sh` so a fresh inject produces a device that reaches P:3 on its own.

See `.arch/image_processes.md` for detailed build commands and `.arch/build_guide.md` for step-by-step instructions.

## Current State (v10-5-0-MANAGER)

### Completed — Core (v7-v9)
- ✅ 11-step automated firstboot (`atlas_firstboot.sh`, ~1400 lines)
- ✅ NTP clock sync before apt — prevents signature verification failures from clock skew
- ✅ Resilient batched package install — 3 batches with `--fix-missing` and retry logic
- ✅ Chromium install retry — separate batch with fresh `apt-get update` on failure
- ✅ Filesystem resize re-enable — `finalize_phase1()` re-enables self-deleting Armbian resize service
- ✅ TTY flash fix — VT1 pre-painted black (tty1-3 + framebuffer + kernel printk)
- ✅ Grey flash fix — overlay window hides Chromium compositor surface
- ✅ Plymouth hold — `ods-plymouth-hold.service` blocks `plymouth-quit` until player ready
- ✅ Admin auth — `su`/PAM-based (yescrypt-safe)
- ✅ Chromium managed policy, dark GTK theme, VT lockdown, sleep prevention
- ✅ RustDesk remote access, Esper MDM enrollment, health monitor
- ✅ Boot diagnostics — snapshot + journalctl per boot
- ✅ Chromium `--app` mode (not `--kiosk`) for overlay compatibility

### Completed — v8 Boot UX Sprint
- ✅ 4K Plymouth theme, throbber (.90), watermark (.5), 5-frame animations
- ✅ FBI bridge (RGB565), "Starting services", "Launching ODS" splash sets
- ✅ Enrollment splash — "Connecting to server" + "Enrollment in progress"
- ✅ `brand/splash/generated/` — single source of truth for all splash assets

### Completed — v9.2-9.3 WiFi AP & Network Sprint
- ✅ WiFi AP mode (hostapd/dnsmasq), QR WiFi join, captive portal
- ✅ Configurable DHCP/Static per-interface, WiFi client connection flow
- ✅ Glass card + wallpaper, status pill, keyboard shortcuts (I/K/O/B)
- ✅ Modular server architecture — `server.js` (195 lines) + 4 route modules

### Completed — v10.1 Modularization & Content Sprint
- ✅ **Modular server architecture** — `server.js` refactored from 1,165→194 lines with 4 Express routers
- ✅ **Firstboot routes/ deploy** — `atlas_firstboot.sh` updated to deploy route modules
- ✅ **Player unit test suite** — 78/78 passing
- ✅ **Content delivery** — zone rendering, dual-screen boot, monitors API
- ✅ **Fast boot** — live-first, cache-later architecture
- ✅ **Loader-ready signal** — `player_content_manager.html` signals boot completion

### Completed — v10.2-10.3 Boot Stability Sprint
- ✅ **Rollback to proven `e417033` pipeline** — removed runtime `convert -resize` and `xrandr --preferred`
- ✅ **Explicit `--mode 1920x1080`** — prevents DRM mode switch flash on 4K-capable displays
- ✅ **Enrolled device routing** — boots to `player_status.html` when no content
- ✅ **VERSION file deployed by firstboot** — version tracking on device

### Completed — v10.4 Dual-Screen & Dynamic Resolution Sprint
- ✅ **Dynamic resolution detection** — per-screen scale factor (Screen 0 vs Screen 1)
- ✅ **Screen 1 watermark** — correct `watermark.png` instead of `ODS_Background.png`
- ✅ **Screen 1 Chromium auto-respawn** — recovery loop for crash resilience
- ✅ **Openbox maximization fix** — prevents Screen 1 from snapping to primary
- ✅ **429 backoff** — rate-limit handling for cloud API
- ✅ **Registration status** — device registration feedback

### Completed — v10.5 Zero-Flash Boot Pipeline (MILESTONE)
- ✅ **Pre-splash modesets** — ALL `xrandr` modesets moved before splash paint (DRM blanks invisible during black screen)
- ✅ **HDMI-2 detection fix** — 0.3s DRM settle delay after `ods-display-config.sh` prevents race condition
- ✅ **Splash persistence** — removed premature `xsetroot -solid black` calls that broke splash continuity
- ✅ **Black overlay creation** — `xrdb -merge '*background: black'` + `-background black` eliminates white flash
- ✅ **Screen 1 smooth fade** — fade-in transition on HDMI-2 overlay kill
- ✅ **Verified**: snapshots #3-#6 all 28KB+ (splash persists continuously from paint to overlay)

### 7 Root Cause Fixes (v9-1-0 → v9-1-7)

| # | Root Cause | Fix | Commit |
|---|-----------|-----|--------|
| 1 | Armbian `armbian-firstlogin` deletes gate file | ODS-owned gate file + mask first-login | `7b82395` |
| 2 | `After=network-online.target` blocks forever without ethernet | `After=basic.target` + script-level wait | `ef98b61` |
| 3 | `set -e` silently kills 1400-line script on any non-zero return | `set -o pipefail` + ERR trap | `6ab2af1` |
| 4 | Single `apt-get install` batch cascading failure | 3 resilient batches with `--fix-missing` | `ddc498e` |
| 5 | Clock skew → apt signature check fails → Chromium 404 | NTP sync + Chromium retry | `c568e7b` |
| 6 | `armbian-resize-filesystem` self-deletes after P:1 | `finalize_phase1()` re-enables resize | `054a3d0` |

### Golden Image History

Complete lineage of every golden image ever built:

| Image | Codename | Date | Milestone |
|-------|----------|------|-----------|
| v1-0-0 — v6-0 | INITIAL→SPLASH | 2/16-18/26 | Foundation builds (firstboot, lockdown, Plymouth) |
| v7-0 — v7-14 | OPENBOX | 2/21-22/26 | Window manager, overlay approach, FBI bridge, grey flash hunt |
| v8-1-0 — v8-3-3 | FLASH | 2/22-23/26 | Premium boot UX, enrollment, multi-res, player rename |
| v9-0-0 | ORIGIN | 2/24/26 | Major: naming, consolidated assets, docs refresh |
| v9-1-0 — v9-1-7 | ORIGIN | 2/26/26 | 7 root cause fixes (gate file, apt, resize, etc.) |
| v9-2-0 — v9-3-2 | ORIGIN | 2/27-28/26 | WiFi AP, captive portal, glass card, status pill, keyboard shortcuts |
| v10-1-0 | MANAGER | 3/1/26 | Modularization, routes/ deploy, tests (78/78) |
| v10-2-0 | MANAGER | 3/2/26 | Rollback to `e417033` pipeline (runtime resize regression) |
| v10-3-0 | MANAGER | 3/2/26 | Explicit `--mode 1920x1080` (no flash) |
| v10-4-0 | MANAGER | 3/3/26 | Dynamic resolution, Screen 1 watermark, auto-respawn, 429 backoff |
| **v10-5-0** | **MANAGER** | **3/6/26** | **Zero-flash boot: pre-splash modesets, DRM settle, HDMI-2 fix, black overlay** |

### Commit History (v10 Series)

| Version | Commit | Key Change |
|---------|--------|------------|
| v10-1-0 | `9f4e259` | Modularization + firstboot routes/ deploy |
| v10-1-1 | `06e0dfe` | Firstboot ods-setup-ap.sh + VERSION deploy |
| v10-1-2 | `7f83e20` | Move ods-setup-ap.sh to deploy_player_scripts() |
| v10-2-0 | `fae29f7` | Rollback boot pipeline to proven `e417033` state |
| v10-3-0 | `f8ae41e` | Revert display config to `--mode 1920x1080` (no flash) |
| v10-4-0 | `ae1df8d` | Dynamic resolution, Screen 1 watermark, 429 backoff |
| v10-4-0+ | `de10c94` | Screen 1 auto-respawn via subshell |
| v10-4-0+ | `cbd5350` | Openbox maximization fix for Screen 1 |
| v10-4-0+ | `09e13ed` | HD boot pipeline + diagnostics + HDMI-2 fix |
| v10-4-0+ | `2f16913` | Plymouth: legacy centered-element approach |
| v10-4-0+ | `078b9ab` | Throbber bottom (.92) + xsetroot black |
| v10-4-0+ | `0cc91f2` | Eliminate tiled watermark flash + boot diagnostics |
| v10-4-0+ | `cc50d55` | White flash fix: black overlay + Screen 0 fade-in |
| v10-4-0+ | `03906a1` | Restore `e417033` splash persistence + black pre-kill |
| **v10-5-0** | **`358e519`** | **Move ALL display modesets before splash — zero-flash** |

### Pending / Next Version
- [x] Zero-flash boot pipeline — pre-splash modesets
- [x] HDMI-2 DRM settle fix
- [x] Black overlay creation
- [x] Screen 1 smooth fade
- [ ] P:0 golden image rebuild → **v10-5-0-MANAGER**
- [ ] ODS Cloud — Player Settings UI for wallpaper, border template, appearance config
- [ ] ODS Cloud — Content delivery pipeline (cloud-sync, cache-manager)
- [ ] OTA updates from ODS Cloud dashboard
- [ ] Wayland/Cage migration for zero-flash boot

## Script Architecture

### Naming Convention

| Category | Example | ATLAS Tag? | Rationale |
|----------|---------|-----------|-----------|
| Boot wrapper | `ods-player-boot-wrapper.sh` | No | Universal across OS versions |
| Chromium launcher | `start-player-os-ATLAS.sh` | Yes | OS-specific |
| Systemd service | `ods-player-ATLAS.service` | Yes | OS-specific |
| Signal file | `/tmp/ods-player-os-starting-ATLAS` | Yes | OS-specific |
| Build tools | `inject_atlas.sh` | N/A | Build-time only |

### File Map

| Script | Runs On | Purpose |
|--------|---------|---------|
| `inject_atlas.sh` | jdl-mini-box / Lima | P:0 image builder (loop-mount inject) |
| `atlas_firstboot.sh` | Target device | 11-step provisioning on first boot (~1400 lines) |
| `ods-phase-selector.sh` | Target device | Routes Phase 2 (enrollment) vs Phase 3 (production) |
| `ods-player-boot-wrapper.sh` | Target device | Full premium boot pipeline orchestrator |
| `start-player-os-ATLAS.sh` | Target device | Chromium `--app` mode launcher |
| `ods-enrollment-boot.sh` | Target device | Phase 2 enrollment (sealed splash, no Xorg) |
| `generate_splash_frames.sh` | jdl-mini-box | Regenerates all splash PNGs from base watermark |
| `ods-display-config.sh` | Target device | xrandr resolution configuration |
| `ods-setup-ap.sh` | Target device | WiFi AP management (start/stop/status/ssid) |

## Key Patterns

### Debian Trixie Auth (yescrypt)
Python 3.13 removed `crypt` AND `spwd` modules. `openssl passwd` doesn't support yescrypt (`$y$`). Use `su` via PAM:
```bash
echo "$PASS" | su -c "echo OK" "$USER" 2>/dev/null | grep -q "^OK$"
```

### SUDO_ASKPASS for SSH Builds
`sudo -S` hangs over SSH due to pam_tty. Use `SUDO_ASKPASS` with `sudo -A`.

### Explicit Paths with Sudo
`sudo` sets `$HOME=/root`, breaking default paths. Always pass explicit paths.

### Multi-Resolution Overlay
Splash assets are 4K source. The boot wrapper detects resolution via `xrandr` and uses `convert -resize "${SCREEN_FULL}!"` to scale them at runtime. Never assume 4K output.

### Credentials
Device credentials are in `scripts/atlas_secrets.conf` (root: `0D5@dm!n`). Build server (jdl-mini-box) password: `mnbvcxz!!!`. Always check project docs before SSH attempts.

> **⚠️ Always use `sshpass`** for SSH/SCP connections. Never rely on interactive password prompts or stdin follow-up. Example: `sshpass -p '0D5@dm!n' ssh -o StrictHostKeyChecking=no root@10.111.123.102 'command'`

### WiFi AP Setup (Phone Config)
hostapd runs in AP mode on wlan0 with `country_code=US`, `ieee80211n=1`, channel 6, hidden SSID. AP start kills `wpa_supplicant` first (it fights hostapd for wlan0). WiFi scan endpoint guarded with `pgrep -x hostapd` to prevent disrupting AP mode. dnsmasq uses `except-interface=end0` (Pi5 Armbian ethernet name).

### WiFi Client Connection (After Captive Portal)
After user submits WiFi creds via captive portal, server.js tears down AP and connects to WiFi:
- **Cannot use `systemctl stop ods-setup-ap`** — its stop handler starts `wpa_supplicant` in D-Bus mode (`-u -s`, no `-i wlan0`) and the `Conflicts=wpa_supplicant.service` kills any manually-started instance
- **Cannot use `dhclient`** — not installed on Armbian Trixie. Use `busybox udhcpc -i wlan0 -n -q`
- **Sudoers required:** `wpa_supplicant`, `killall`, `busybox`, `ip addr *` for the `signage` user
- **Sequence:** `killall hostapd/dnsmasq/wpa_supplicant` → `ip addr flush wlan0` → `ip link set wlan0 up` → `wpa_supplicant -B -i wlan0 -c conf` → 10s wait → `wpa_cli reconfigure` → `busybox udhcpc` → verify via `wpa_cli status`

### Remote Dev Lab Access via Reverse SSH

The dev device and jdl-mini-box are behind NAT on the lab network (`10.111.123.x`). Remote access uses a persistent reverse SSH tunnel from jdl-mini-box to the relay server.

**Chain:** Mac → ods-relay-server (134.199.136.112:22) → jdl-mini-box (localhost:2222) → device (10.111.123.102)

**Local network deployment (preferred — use when on same network as device):**

```bash
# Deploy server + route modules with sshpass (no interactive prompts)
sshpass -p '0D5@dm!n' scp -o StrictHostKeyChecking=no server.js root@10.111.123.102:/home/signage/ODS/
sshpass -p '0D5@dm!n' scp -r -o StrictHostKeyChecking=no routes/ root@10.111.123.102:/home/signage/ODS/
sshpass -p '0D5@dm!n' ssh -o StrictHostKeyChecking=no root@10.111.123.102 'systemctl restart ods-webserver'
```

**Remote deployment via relay (only when outside the lab network):**

```bash
# 1. Copy file to relay server
scp -i ~/.ssh/id_ed25519_ods_relay_dod file.js root@134.199.136.112:/tmp/

# 2. SSH to relay
ssh -i ~/.ssh/id_ed25519_ods_relay_dod root@134.199.136.112

# 3. From relay, SCP file to jdl-mini-box via reverse tunnel (use sshpass)
sshpass -p 'mnbvcxz!!!' scp -o StrictHostKeyChecking=no -P 2222 /tmp/file.js jones-dev-lab@localhost:/tmp/

# 4. From relay, SSH to jdl-mini-box
sshpass -p 'mnbvcxz!!!' ssh -o StrictHostKeyChecking=no -p 2222 jones-dev-lab@localhost

# 5. From jdl-mini-box, SCP to device (use sshpass)
# For server + routes:
sshpass -p '0D5@dm!n' scp -o StrictHostKeyChecking=no /tmp/server.js root@10.111.123.102:/home/signage/ODS/
sshpass -p '0D5@dm!n' scp -r -o StrictHostKeyChecking=no /tmp/routes/ root@10.111.123.102:/home/signage/ODS/
# For player modules:
sshpass -p '0D5@dm!n' scp -o StrictHostKeyChecking=no /tmp/file.js root@10.111.123.102:/home/signage/ODS/player/

# 6. From jdl-mini-box, restart webserver on device
sshpass -p '0D5@dm!n' ssh -o StrictHostKeyChecking=no root@10.111.123.102 'systemctl restart ods-webserver'
```

> **Critical:** The relay has NO private keys — cannot initiate SSH from relay → jdl-mini-box without password auth. The reverse tunnel (`-R 2222:localhost:22`) is initiated BY jdl-mini-box, not the relay. Use `jones-dev-lab` user with password `mnbvcxz!!!` for the port-2222 hop.

> **File paths on device:** Player code lives at `/home/signage/ODS/` (NOT `/home/signage/player/`). Example: `/home/signage/ODS/player/cloud-sync.js`, `/home/signage/ODS/server.js`.

## Environment

| Machine | IP | User | Purpose |
|---------|-----|------|---------|
| ods-relay-server | `134.199.136.112` | root | SSH relay + RustDesk relay |
| ArPi4b (player) | `10.111.123.102` | root / signage | Production test device |
| jdl-mini-box | `10.111.123.134` | jones-dev-lab | Golden image build server (Ubuntu) |
| Mac (dev) | local | robert.leejones | Development, SCP transfer, Lima builds |

