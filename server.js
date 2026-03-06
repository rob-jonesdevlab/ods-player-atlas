/**
 * server.js — ODS Player Atlas: Express orchestrator
 *
 * Lean entry point that mounts modular route domains and handles
 * startup, captive portal detection, enrollment, and server lifecycle.
 *
 * Route Modules:
 *   /api/system/*   → routes/system.js   (system info, actions, logs, volume, timezone)
 *   /api/admin/*    → routes/admin.js     (auth, terminal, SSH, password, services)
 *   /api/*          → routes/network.js   (network status, WiFi, display, static IP)
 *   /api/*          → routes/content.js   (cache, player content, device info, cloud sync)
 */

const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const app = express();
const PORT = 8080;

app.use(express.json());
app.use(express.static('public'));

// ─── Modular Route Mounts ───────────────────────────────────────────────────
app.use('/api/system', require('./routes/system'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/network'));

const contentRoutes = require('./routes/content');
app.use('/api', contentRoutes);

// Serve cached content files directly (for renderer <img>/<video> tags)
app.use('/cache', express.static(contentRoutes.cacheManager.GOOD_CACHE_DIR));

// ========================================
// CAPTIVE PORTAL DETECTION
// ========================================
// When phones join the AP, they probe these URLs to detect captive portals.
// iOS CNA does NOT execute JavaScript or follow meta-refresh redirects.
// We serve captive_portal.html directly so the form renders inside the CNA sheet.
const SETUP_PAGE = path.join(__dirname, 'public', 'captive_portal.html');

// iOS captive portal detection — serve setup page directly
app.get('/hotspot-detect.html', (req, res) => {
    res.status(200).type('html').sendFile(SETUP_PAGE);
});

// Android captive portal detection (expects non-204 response)
app.get('/generate_204', (req, res) => {
    res.status(200).type('html').sendFile(SETUP_PAGE);
});
app.get('/gen_204', (req, res) => {
    res.status(200).type('html').sendFile(SETUP_PAGE);
});

// Windows captive portal detection
app.get('/connecttest.txt', (req, res) => {
    res.status(200).type('html').sendFile(SETUP_PAGE);
});
app.get('/ncsi.txt', (req, res) => {
    res.status(200).type('html').sendFile(SETUP_PAGE);
});

// Catch-all for any captive portal probe from unknown OS
app.get('/redirect', (req, res) => {
    res.redirect('/captive_portal.html');
});

// ========================================
// QR CODE & ENROLLMENT
// ========================================

// Generate QR code
app.get('/api/qr', async (req, res) => {
    try {
        const ssid = require('child_process').execSync(
            '/usr/local/bin/ods-setup-ap.sh ssid 2>/dev/null || echo ODS-Player'
        ).toString().trim();

        const wifiQR = `WIFI:T:nopass;S:${ssid};H:true;;`;
        const qrCode = await QRCode.toDataURL(wifiQR, { width: 400 });
        res.json({ qrCode, ssid, setupUrl: 'http://192.168.4.1:8080/captive_portal.html' });
    } catch (e) {
        console.error('[QR] Error:', e.message);
        res.status(500).json({ error: 'Failed to generate QR' });
    }
});

// Trigger enrollment — register device with ODS Cloud
app.post('/api/enroll', async (req, res) => {
    try {
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        const { stdout: cpuInfo } = await execAsync("cat /proc/cpuinfo | grep Serial | awk '{print $3}'");
        const cpuSerial = cpuInfo.trim() || 'UNKNOWN';

        const uuidFile = '/home/signage/ODS/config/device_uuid';
        let deviceUuid;
        try {
            deviceUuid = fs.readFileSync(uuidFile, 'utf8').trim();
        } catch {
            const crypto = require('crypto');
            deviceUuid = crypto.randomUUID();
            const dir = path.dirname(uuidFile);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(uuidFile, deviceUuid);
        }

        const ODS_SERVER_URL = process.env.ODS_SERVER_URL || 'https://api.ods-cloud.com';
        const pairingRes = await fetch(`${ODS_SERVER_URL}/api/pairing/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cpu_serial: cpuSerial, device_uuid: deviceUuid })
        });

        const pairingData = await pairingRes.json();

        if (pairingRes.ok) {
            fs.writeFileSync('/var/lib/ods/enrollment.flag', JSON.stringify({
                enrolled: true,
                timestamp: new Date().toISOString(),
                device_uuid: deviceUuid,
                pairing_code: pairingData.pairing_code
            }));

            res.json({
                success: true,
                device_uuid: deviceUuid,
                pairing_code: pairingData.pairing_code,
                expires_at: pairingData.expires_at,
                qr_data: pairingData.qr_data
            });
        } else if (pairingRes.status === 409) {
            res.json({ success: true, already_paired: true, account_id: pairingData.account_id });
        } else {
            console.error('[ENROLL] Cloud API error:', pairingData);
            res.status(500).json({ error: pairingData.error || 'Cloud registration failed' });
        }
    } catch (error) {
        console.error('[ENROLL] Error:', error.message);
        res.status(500).json({ error: 'Enrollment failed: ' + error.message });
    }
});

// ========================================
// SIGNAL ENDPOINTS
// ========================================

// Signal that loader is ready (Plymouth can quit)
app.get('/api/loader-ready', (req, res) => {
    const signalFile = '/tmp/ods-loader-ready';
    fs.writeFileSync(signalFile, Date.now().toString());
    console.log('[LOADER] Ready signal received — Plymouth can quit');
    res.json({ success: true });
});

// Page ready signal (for Plymouth transition)
app.post('/api/signal-ready', (req, res) => {
    const signalFile = '/tmp/ods-loader-ready';
    fs.writeFileSync(signalFile, Date.now().toString());
    console.log('[SIGNAL] Page ready — Plymouth can quit');
    res.json({ success: true });
});

// Boot status — Screen 1 polls this to sync watermark reveal with Screen 0
app.get('/api/boot-status', (req, res) => {
    const complete = fs.existsSync('/tmp/ods-boot-complete');
    res.json({ complete });
});

// ========================================
// START SERVER
// ========================================
app.listen(PORT, () => {
    console.log(`[SETUP] ODS Player OS server running on port ${PORT}`);

    // Start cloud sync (WebSocket + config polling)
    contentRoutes.cloudSync.start({
        onContentReady: () => {
            console.log('[CloudSync] 🎬 Content ready — renderer will pick up on next poll');
        }
    });

    // Also listen on port 80 — iOS captive portal detection checks port 80
    const http = require('http');
    http.createServer(app).listen(80, () => {
        console.log('[SETUP] Captive portal listener on port 80 (for iOS/Android)');
    }).on('error', (err) => {
        if (err.code === 'EACCES') {
            console.log('[SETUP] Port 80 requires root — use: sudo setcap cap_net_bind_service=+ep $(which node)');
        } else {
            console.log('[SETUP] Port 80 listener error:', err.message);
        }
    });

    // Clean stale cache daily
    setInterval(() => contentRoutes.cacheManager.cleanStaleCache(7), 24 * 60 * 60 * 1000);
});
