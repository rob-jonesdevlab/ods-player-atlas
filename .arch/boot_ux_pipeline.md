# Boot UX Pipeline — ODS Player OS Atlas v12

**Purpose:** Document the complete visual pipeline from power-on to Chromium kiosk.  
**Kiosk Wrapper:** v12 (clean rebuild)  
**Last Updated:** February 22, 2026  
**Rollback Tag:** `boot-ux-v12-stable` — the "premium product" baseline

---

## The Problem

During the Plymouth → Xorg → Chromium handoff, multiple visual artifacts can appear:

| Issue | Root Cause | Status |
|-------|-----------|--------|
| White TTY flash | Bare VT1 console visible during handoff | ✅ Fixed (v5) |
| White Chromium flash | Chromium renders white before CSS loads | ✅ Fixed (v7-6: dark GTK theme) |
| Grey Chromium flash | Chromium GPU compositor default = `gray(60)` = `#3C3C3C` | 🔄 Mitigated (v12: `--disable-gpu-compositing`) |
| Grey Xorg root | `-background none` = grey stipple default | ✅ Fixed (v7-8: removed flag) |
| 26s bare TTY gap | `plymouth-quit` fires before kiosk starts | ✅ Fixed (v7-10: service deps) |
| Grey modeset resets | KMS color map re-initialized 6+ times | ✅ Fixed (v12: splash animation covers) |

## The Solution (v12)

Three-phase animated splash pipeline covers all visual gaps:
1. **Plymouth throbber** (5s hold) — hardware splash with throbber animation
2. **"Starting ODS services"** (1.5s) — 5-frame dot animation on Xorg root window
3. **"Launching OS"** (until page ready) — 5-frame dot animation while Chromium loads

## Pipeline Sequence

### Phase 1: Kernel Boot
```
Kernel parameters (cmdline.txt):
  splash quiet                        — enable Plymouth
  loglevel=3                          — suppress verbose kernel output
  consoleblank=0                      — prevent console blanking
  vt.global_cursor_default=0          — hide cursor globally
  plymouth.ignore-serial-consoles     — prevent serial console interference
```

### Phase 2: Plymouth Splash (held 5 seconds)
```
Plymouth ODS theme (/usr/share/plymouth/themes/ods/):
  ModuleName=two-step
  Font=DejaVu Sans Bold 15
  BackgroundStartColor=0x000000       — solid black
  UseFirmwareBackground=false

Kiosk wrapper holds Plymouth for 5s before quit --retain-splash
```

### Phase 3: VT1 Blackout
```bash
dmesg -D                             # Disable kernel console printk
echo 0 > /proc/sys/kernel/printk     # Belt-and-suspenders
for tty in /dev/tty1 /dev/tty2 /dev/tty3; do
    setterm --foreground black --background black --cursor off > "$tty"
done
dd if=/dev/zero of=/dev/fb0 bs=65536 count=512 conv=notrunc  # Black framebuffer
```

### Phase 4: Xorg Start + "Starting ODS services" Animation
```bash
Xorg :0 -nolisten tcp -novtswitch vt1 -br &
xhost +local:  # Allow local users X11 access

# 5-frame animated splash on root window (1.5s total)
for _f in 1 2 3 4 5; do
    display -window root "$ANIM_DIR/splash_ods_${_f}.png"
    sleep 0.3
done
```

### Phase 5: Openbox + "Launching OS" Animation + Chromium
```bash
openbox --config-file /etc/ods/openbox-rc.xml &
export GTK_THEME="Adwaita:dark"

# Launch Chromium (kiosk mode, on-screen)
/usr/local/bin/start-kiosk.sh &

# Animated loop on root window until page ready
while [ ! -f /tmp/ods-loader-ready ]; do
    for _d in 1 2 3 4 5; do
        display -window root "$ANIM_DIR/splash_launch_${_d}.png"
        sleep 0.3
    done
done
```

### Phase 6: Page Ready + Cleanup
```bash
# network_setup.html calls /api/signal-ready → touches /tmp/ods-loader-ready
# FOUC guard: page starts at opacity:0, fades to opacity:1 on body.ready
# Plymouth quit fires after page is fully rendered
```

## Chromium Launch Configuration

```bash
chromium --no-sandbox \
  --kiosk --start-fullscreen \
  --default-background-color=000000 \
  --force-dark-mode \
  --disable-gpu-compositing \
  --noerrdialogs --disable-infobars \
  "http://localhost:8080/preload.html"
```

### Key Flags
| Flag | Purpose |
|------|---------|
| `--disable-gpu-compositing` | Eliminates/reduces `gray(60)` flash from GPU compositor |
| `--default-background-color=000000` | Sets initial surface to black (limited effect on v144) |
| `--force-dark-mode` | Forces dark UI elements |
| `--no-sandbox` | ⚠️ Required when running as root — see Security section |

## Splash Assets

All splash frames stored at `/usr/share/plymouth/themes/ods/`:

| File | Content |
|------|---------|
| `watermark.png` | Base ODS splash (no text) |
| `splash_ods_1.png` – `splash_ods_5.png` | "Starting ODS services." → "....." |
| `splash_launch_1.png` – `splash_launch_5.png` | "Launching OS." → "....." |
| `splash_boot_complete.png` | Legacy "Boot complete..." (deprecated) |

## Security: `--no-sandbox` Risk Assessment

### Why It's Used
Chromium refuses to run as root without `--no-sandbox`. The kiosk service runs as root
because the wrapper needs root access for: VT manipulation, framebuffer writes, Plymouth control,
Xorg startup, and kernel parameter changes.

### Attack Surface
| Vector | Risk | Mitigation |
|--------|------|------------|
| Compromised web content can escape renderer | **HIGH** | Device only loads localhost pages |
| Renderer exploit gains root access | **HIGH** | Network firewall, read-only filesystem (planned) |
| XSS on localhost page | **MEDIUM** | No external content loaded |
| Remote debugging port (9222) | **MEDIUM** | Bind to localhost only |

### Recommended Fix (Future)
Split the wrapper into privileged and unprivileged phases:
1. Root phase: VT blackout, Plymouth, Xorg startup
2. `User=signage` phase: Openbox, Chromium (with full sandbox)
Requires restructuring into two systemd services.

## Visual Timeline (v12)

```
t=0.0s   Power on
t=2.0s   Plymouth splash visible (ODS logo + throbber)
t=6.9s   Wrapper starts → VT blackout
t=11.9s  Plymouth quit (held 5s)
t=15.2s  Xorg ready
t=15.5s  "Starting ODS services." animation (1.5s)
t=17.5s  Openbox + Chromium launched
t=17.5s  "Launching OS." animation starts
t=24.0s  Page ready signal → animation killed → Boot complete
```

## Known Remaining Issue: Grey Flash

**What:** Brief `gray(60)` = `#3C3C3C` flash (~400ms) when Chromium's kiosk window first maps.

**Root Cause:** Chromium 144's GPU compositor creates a default surface at `#3C3C3C` before the
renderer draws the first frame. This is a Chromium-internal behavior. The `--default-background-color`
flag does NOT affect this compositor surface in Chromium 144.

**Evidence:** Boot screenshots captured exact color at center pixel:
```
frame_001-006: gray(0)     ← Black (root window)
frame_007-008: gray(60)    ← GREY FLASH (compositor surface)
frame_009-010: srgb(0,0,0) ← Page content (black background)
```

**Mitigation:** `--disable-gpu-compositing` significantly reduces the flash duration. The animated
"Launching OS" splash on the root window provides visual continuity.

**Attempted Fixes That Did Not Work:**
- `--default-background-color=FF000000` (ARGB wrong byte order)
- `--default-background-color=000000FF` (RGBA — still no effect)
- `--default-background-color=000000` (6-digit — no effect)
- `--force-dark-mode` (no effect on compositor surface)
- GTK CSS override `background-color: #000` (GTK is above compositor)
- Off-screen window position + xdotool move (grey on move)
- xterm overlay approach (kiosk mode overrides stacking)
- FBI framebuffer bridge (wrong DRM device, can't coexist with Xorg)
- preload.html with inline black CSS (grey precedes any HTML rendering)

## Lessons Learned (v12)

| Lesson | Details |
|--------|---------|
| `set -e` kills kiosk wrappers | Any non-zero exit (from display, xrandr) terminates the script |
| `su -c` garbles Chromium env | SingletonLock, XDG_RUNTIME_DIR, D-Bus all break |
| `runuser -u` also fails for Chromium | Same env issues as `su -c` |
| Gray(60) is Chromium compositor | Not GTK, not root window, not page CSS |
| `--disable-gpu-compositing` helps | Reduces grey flash to near-imperceptible |
| sed surgery causes regression | After 10+ sed edits, write complete files via scp |
| Splash animation covers gaps | Animated dots create visual continuity during loading |
