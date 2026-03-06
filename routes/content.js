/**
 * routes/content.js — Content delivery, cache, and player sync routes
 *
 * Extracted from monolithic server.js. Handles:
 *  - Content cache management (sync, status, clean, serve)
 *  - Player content delivery (smart decision tree for fast boot)
 *  - Cloud sync status and manual triggers
 *  - Device info API
 */

const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const cacheManager = require('../player/cache-manager');
const cloudSync = require('../player/cloud-sync');
const router = express.Router();

// ─── Cache Management ───────────────────────────────────────────────────────

// Manual sync trigger
router.post('/cache/sync', async (req, res) => {
    try {
        const enrollment = cacheManager.getCachedConfig()
            ? JSON.parse(fs.readFileSync('/var/lib/ods/enrollment.flag', 'utf8'))
            : null;

        if (!enrollment) {
            return res.status(400).json({ error: 'Player not enrolled' });
        }

        const result = await cacheManager.syncContent(
            enrollment.cloud_url,
            enrollment.player_id,
            enrollment.api_token
        );

        res.json(result);
    } catch (error) {
        console.error('[Cache] Sync error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Cache status
router.get('/cache/status', (req, res) => {
    const offline = cacheManager.checkOfflineCapability();
    const manifest = cacheManager.loadManifest();

    res.json({
        canOperate: offline.canOperate,
        assetCount: offline.assetCount,
        configCached: offline.config !== null,
        configHash: offline.config?.config_hash || null,
        assets: Object.entries(manifest).map(([id, entry]) => ({
            id,
            filename: entry.filename,
            type: entry.type,
            checksum: entry.checksum,
            downloadedAt: entry.downloadedAt
        }))
    });
});

// Serve cached content files
router.get('/cache/content/:contentId', (req, res) => {
    const localPath = cacheManager.getCachedAssetPath(req.params.contentId);
    if (!localPath) {
        return res.status(404).json({ error: 'Content not cached' });
    }
    res.sendFile(localPath);
});

// Clean stale cache
router.post('/cache/clean', (req, res) => {
    const maxDays = req.body.maxAgeDays || 7;
    cacheManager.cleanStaleCache(maxDays);
    res.json({ success: true, message: `Cleaned stale files older than ${maxDays} days` });
});

// ─── Player Content Delivery ────────────────────────────────────────────────

// Rate limit backoff state (shared with cloud-sync module)
let backoffUntil = 0;

// GET /player/content — Smart decision tree for fast boot
// Priority: cache (if unchanged) → live (if changed or no cache) → offline (if no network)
router.get('/player/content', async (req, res) => {
    // If we're in backoff from a 429, return immediately with retry hint
    if (Date.now() < backoffUntil) {
        const retryIn = Math.ceil((backoffUntil - Date.now()) / 1000);
        console.log(`[Content] ⏸️ Rate-limit backoff — retry in ${retryIn}s`);
        return res.json({ hasContent: false, playlist: null, bootMode: 'backoff', retryAfter: retryIn });
    }
    try {
        const cachedContent = cloudSync.getContentForRenderer();
        const cacheReady = cloudSync.isCacheReady();

        if (cachedContent && cacheReady.ready) {
            const { changed, offline } = await cloudSync.hasPlaylistChanged();

            if (!changed) {
                console.log('[Content] 🚀 Cache hit — serving cached content (playlist unchanged)');
                return res.json({ hasContent: true, playlist: cachedContent, bootMode: 'cache' });
            }

            if (offline) {
                console.log('[Content] 📴 Offline — serving cached content');
                return res.json({ hasContent: true, playlist: cachedContent, bootMode: 'offline-cache' });
            }

            console.log('[Content] 🔄 Playlist changed — fetching live content');
            const liveContent = await cloudSync.fetchLiveContent();
            if (liveContent) {
                cloudSync.doSync();
                return res.json({ hasContent: true, playlist: liveContent, bootMode: 'live-changed' });
            }

            console.log('[Content] ⚠️ Live fetch failed — serving stale cache');
            return res.json({ hasContent: true, playlist: cachedContent, bootMode: 'stale-cache' });
        }

        if (cachedContent && !cacheReady.ready) {
            console.log(`[Content] ⏳ Cache partial (${cacheReady.cached}/${cacheReady.total}) — serving with live fallback`);
            cloudSync.doSync();
            return res.json({ hasContent: true, playlist: cachedContent, bootMode: 'partial-cache' });
        }

        console.log('[Content] 📡 No cache — fetching live content from cloud');
        const liveContent = await cloudSync.fetchLiveContent();
        if (liveContent) {
            cloudSync.doSync();
            return res.json({ hasContent: true, playlist: liveContent, bootMode: 'live-cold' });
        }

        console.log('[Content] ❌ No cache and no network — no content available');
        return res.json({ hasContent: false, playlist: null, bootMode: 'empty' });

    } catch (error) {
        console.error('[Content] Decision tree error:', error.message);
        // Detect 429 in error chain and set backoff
        if (error.message && error.message.includes('429')) {
            backoffUntil = Date.now() + 30000;
        }
        const cachedContent = cloudSync.getContentForRenderer();
        if (cachedContent) {
            return res.json({ hasContent: true, playlist: cachedContent, bootMode: 'error-fallback' });
        }
        return res.json({ hasContent: false, playlist: null, bootMode: 'error' });
    }
});

// GET /player/sync-status — Returns sync health for system config panel
router.get('/player/sync-status', (req, res) => {
    res.json(cloudSync.getStatus());
});

// POST /player/sync-now — Manual sync trigger (from system config)
router.post('/player/sync-now', async (req, res) => {
    try {
        await cloudSync.doSync();
        res.json({ success: true, status: cloudSync.getStatus() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /player/cache-ready — Check if all assets are cached
router.get('/player/cache-ready', (req, res) => {
    const cacheStatus = cloudSync.isCacheReady();
    res.json(cacheStatus);
});

// ─── Device Info ────────────────────────────────────────────────────────────
router.get('/device/info', (req, res) => {
    const commands = {
        three_word_name: 'hostname 2>/dev/null || echo unknown',
        mac_address: "cat /sys/class/net/end0/address 2>/dev/null || cat /sys/class/net/eth0/address 2>/dev/null || echo --",
        connection_method: "ip route get 8.8.8.8 2>/dev/null | head -1 | sed -n 's/.*dev \\([^ ]*\\).*/\\1/p' || echo --",
        ssid: "iwgetid -r 2>/dev/null || echo ''",
        ip_address: "hostname -I 2>/dev/null | awk '{print $1}' || echo --"
    };

    let completed = 0;
    const total = Object.keys(commands).length;
    const info = {};

    for (const [key, cmd] of Object.entries(commands)) {
        exec(cmd, { timeout: 3000 }, (error, stdout) => {
            info[key] = stdout ? stdout.trim() : '--';
            completed++;

            if (completed === total) {
                const iface = info.connection_method;
                let connType = 'Unknown';
                if (iface.startsWith('eth') || iface.startsWith('end')) connType = 'Ethernet';
                else if (iface.startsWith('wl')) connType = 'WiFi';

                let account_name = '';
                let device_name = '';
                try {
                    const flagData = JSON.parse(fs.readFileSync('/var/lib/ods/enrollment.flag', 'utf8'));
                    account_name = flagData.account_name || 'Registering...';
                    device_name = flagData.device_name || 'Registering...';
                } catch (e) { /* not paired yet */ }

                res.json({
                    three_word_name: info.three_word_name,
                    mac_address: info.mac_address,
                    connection_type: connType,
                    ssid: connType === 'WiFi' ? info.ssid : '',
                    ip_address: info.ip_address,
                    account_name,
                    device_name
                });
            }
        });
    }
});

// Export router and modules for server.js to access (cloudSync.start, cacheManager statics)
module.exports = router;
module.exports.cloudSync = cloudSync;
module.exports.cacheManager = cacheManager;
