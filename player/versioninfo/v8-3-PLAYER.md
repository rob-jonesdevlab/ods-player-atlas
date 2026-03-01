# v8-3 PLAYER — Network Setup & Pairing

**Date Range:** February 22-23, 2026  
**Images:** v8-3-3-PLAYER  
**Codename:** PLAYER

---

## Overview

The v8-3 PLAYER series built the complete WiFi setup and device pairing flow: captive portal AP, network configuration, QR code-based pairing, and the glass card player ready page.

## Key Changes

| Area | Change |
|------|--------|
| Captive portal | `captive_portal.html` served for iOS CNA, Android 204, Windows NCSI probes |
| WiFi setup | `network_setup.html` — SSID scan, credentials, AP teardown → client mode switch |
| Player link | `player_link.html` — 6-digit pairing code + QR code (ODS Cloud pairing URL) |
| Glass card | Frosted-glass card UI with Otter logo, device info, status pill |
| Auto-pairing | Server-side polling: code → account link → redirect to player ready |
| Connection status | Real-time WiFi connection progress with status pill updates |
| AP mode | `ods-setup-ap.sh` — hostapd/dnsmasq setup for phone-to-Pi direct connection |

## Page Flow

```
network_setup.html → (WiFi connected) → player_link.html → (paired) → player_ready.html
```
