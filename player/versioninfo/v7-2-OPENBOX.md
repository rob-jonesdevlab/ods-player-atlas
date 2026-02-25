# v7-2-OPENBOX — Admin Auth, Player Redesign, MAC Hostname

**Released:** 2026-02-21
**Image:** `ods-atlas-golden-v7-2-OPENBOX.img` (1.8G)
**Repo:** `ods-player-os-atlas`
**Commit:** `643d84d`
**Patch of:** v7-1-OPENBOX

---

## Summary

Major update addressing 7 issues from v7-1 field test: broken admin auth, Chromium password popup, ungated system sections, player screen redesign with MAC-based three-word hostname, and brand logo.

## Fixes

### Fix A: Admin Auth Broken
- **Root cause:** `echo pw | su -c 'echo OK' otter` fails — PAM requires TTY for `su` pipe
- **Fix:** Python `crypt`+`spwd` validator (`ods-auth-check.sh`) reads `/etc/shadow` via sudoers
- **Files:** `atlas_firstboot.sh` (deploys script + sudoers), `server.js` (calls via `sudo`)

### Fix B: Chromium Password Manager Popup
- **Fix:** Added 4 flags: `--password-store=basic`, `--credentials-enable-service=false`, `--disable-save-password-bubble`, `--disable-autofill-keyboard-accessory-view`
- **File:** `atlas_firstboot.sh` (start-kiosk.sh)

### Fix C: System Info / Security / Maintenance Ungated
- **Fix:** Moved below admin divider with `hidden` class + `data-admin-required` attribute
- **File:** `system_config.html`

### Fix D: Player Ready Redesign
- Background: `ODS_Background.png` (matches network/pair screens)
- Logo: User's `ods-player-logo.png` (monitor icon)
- Rows: Account, Device, Hostname (three-word), IP Address, Network (color-coded)
- Removed: CPU Temp, "System Options" footer
- **Files:** `player.html` (full rewrite), `ods-player-logo.png` (new asset)

### Fix E: MAC-Based Three-Word Hostname
- Algorithm: last 3 MAC bytes → 256-word list × 3 positions = 16.7M combos
- Deterministic + reversible (name → MAC bytes)
- Set via `hostnamectl` during firstboot
- **Files:** `atlas_firstboot.sh` (ods-hostname.sh + set_hostname()), `server.js` (/api/device/info)

### Fix F: Network Connection Method Display
- Shows "Ethernet" or "WiFi (SSID)" in green when connected
- **Files:** `player.html`, `server.js` (/api/device/info)

## Files Changed

| File | Changes |
|------|---------|
| `scripts/atlas_firstboot.sh` | Chromium flags, auth script, hostname script, hostname setup |
| `server.js` | PAM auth, /api/device/info endpoint |
| `public/system_config.html` | Admin-gated nav items |
| `public/player.html` | Full rewrite |
| `public/resources/ods-player-logo.png` | Brand logo asset |
