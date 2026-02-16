# ODS Player OS - Atlas

**Version:** 1.x (Atlas)  
**Code Name:** Atlas - Foundation Release  
**Purpose:** Dedicated runtime for ODS Player devices

---

## Overview

Atlas is the foundation release of ODS Player OS, providing core functionality for digital signage devices including device pairing, network configuration, and auto-recovering kiosk mode.

## Features

- **Device Pairing** - QR code-based pairing with ODS Cloud dashboard
- **Network Configuration** - WiFi and Ethernet setup
- **WebSocket Communication** - Real-time connection to ODS Cloud server
- **Auto-Recovering Kiosk Mode** - Chromium auto-restarts on crash/close
- **Headless Display** - No desktop environment, black screen failover

## Architecture

```
ods-player-os-atlas/
├── public/               # Web server public directory
│   ├── resources/
│   │   └── designs/      # Logos, wallpapers, branding
│   ├── pairing.html      # Device pairing interface
│   ├── qr.html           # Network setup interface
│   ├── enrolling.html    # Enrollment status
│   └── setup.html        # Initial setup
├── server.js             # Lightweight Express server
├── package.json          # Node.js dependencies
├── VERSION               # Current version code name ("atlas")
├── scripts/              # Deployment automation
└── README.md
```

## Deployment

### Flash with `ods-pi5-host`

This repository is deployed automatically during the OS flash process via `ods-pi5-host` deployment scripts.

### Manual Installation

```bash
# Clone repository
cd /home/signage
git clone https://github.com/rob-jonesdevlab/ods-player-os-atlas.git ODS
cd ODS

# Install dependencies
npm install

# Start server
npm start
```

### Kiosk Configuration

The kiosk mode is configured via `/usr/local/bin/start-kiosk.sh` which:
- Auto-restarts Chromium on close/crash
- Sets black background (no desktop visibility)
- Disables screen blanking
- Hides cursor

## Server Configuration

**API Endpoint:** `http://209.38.118.127:3001`

**Environment Variables:**
- `PORT` - Server port (default: 8080)
- `API_URL` - ODS Cloud API endpoint
- `WS_URL` - WebSocket server URL

## File Locations (on device)

| Component | Path |
|-----------|------|
| Player Runtime | `/home/signage/ODS/` |
| Public Files | `/home/signage/ODS/public/` |
| Server | `/home/signage/ODS/server.js` |
| Resources | `/home/signage/ODS/public/resources/` |
| Kiosk Script | `/usr/local/bin/start-kiosk.sh` |
| Plymouth Theme | `/usr/share/plymouth/themes/ods/` |

## Version History

| Version | Code Name | Focus Area |
|---------|-----------|------------|
| v1.x | **Atlas** (A) | Foundation - Pairing, player core, basic UI |

## Next Version

**Beacon** (v2.x) - Dynamic configuration & remote management

- Remote background customization via Content Library
- Advanced playlist features
- Analytics integration
- Multi-zone support

## Development

### Local Testing

```bash
# Start development server
npm run dev

# Access interfaces
open http://localhost:8080/qr.html
open http://localhost:8080/pairing.html
```

### Making Changes

1. Edit files in `public/`
2. Test locally
3. Deploy to device:
   ```bash
   scp public/*.html root@device-ip:/home/signage/ODS/public/
   ```
4. Restart Chromium on device (auto-restarts)

## Troubleshooting

### Network Setup Not Loading
- Check server is running: `systemctl status ods-webserver`
- Verify port 8080 is accessible
-Check logs: `journalctl -u ods-webserver -f`

### Pairing QR Code Not Generating
- Verify server connection: `curl http://209.38.118.127:3001/api/health`
- Check browser console for errors
- Verify device UUID generation: `/usr/local/bin/device_uuid_generator.py`

### Chromium Not Auto-Restarting
- Check kiosk script: `cat /usr/local/bin/start-kiosk.sh`
- Verify X session: `echo $DISPLAY`
- Check process: `ps aux | grep chromium`

## License

Copyright © 2026 ODS Cloud. All rights reserved.

## Support

For issues or questions, contact support@ods-cloud.com
