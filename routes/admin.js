/**
 * routes/admin.js — Admin authentication and device management routes
 *
 * Extracted from monolithic server.js. Handles:
 *  - Admin login (otter user PAM auth)
 *  - Session management (in-memory, 30min expiry)
 *  - Terminal launch
 *  - Service restart/status
 *  - Password change
 *  - SSH toggle
 */

const express = require('express');
const { exec } = require('child_process');
const crypto = require('crypto');
const router = express.Router();

// Simple session tracking (in-memory, resets on restart — fine for device-local)
const adminSessions = new Map();

// ─── Session Middleware ─────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
    const token = req.headers['x-admin-token'] || req.body.token;
    if (!token) {
        return res.status(401).json({ error: 'Admin authentication required' });
    }

    const session = adminSessions.get(token);
    if (!session || session.expires < Date.now()) {
        adminSessions.delete(token);
        return res.status(401).json({ error: 'Session expired' });
    }

    req.adminUser = session.username;
    next();
}

// ─── Login ──────────────────────────────────────────────────────────────────
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    // Only allow 'otter' user login
    if (username !== 'otter') {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Validate via PAM crypt+spwd (reads /etc/shadow via sudo)
    const escapedUser = username.replace(/[^a-zA-Z0-9_]/g, '');
    const escapedPass = password.replace(/'/g, "'\\''");
    exec(`sudo /usr/local/bin/ods-auth-check.sh '${escapedUser}' '${escapedPass}'`, { timeout: 5000 }, (error, stdout) => {
        if (stdout && stdout.trim() === 'OK') {
            const token = crypto.randomBytes(32).toString('hex');
            adminSessions.set(token, {
                username,
                created: Date.now(),
                expires: Date.now() + (30 * 60 * 1000) // 30 min session
            });
            console.log(`[ADMIN] ${username} authenticated successfully`);
            res.json({ success: true, token });
        } else {
            console.log(`[ADMIN] Failed login attempt for ${username}`);
            res.status(401).json({ error: 'Invalid credentials' });
        }
    });
});

// ─── Terminal ───────────────────────────────────────────────────────────────
router.post('/terminal', requireAdmin, (req, res) => {
    exec('DISPLAY=:0 xterm -title "Admin Terminal" -fa "Monospace" -fs 14 -bg "#1a1a2e" -fg "#00ff88" &');
    console.log(`[ADMIN] Terminal launched by ${req.adminUser}`);
    res.json({ success: true, message: 'Admin terminal launched' });
});

// ─── Service Restart ────────────────────────────────────────────────────────
router.post('/restart-services', requireAdmin, (req, res) => {
    console.log(`[ADMIN] Services restart requested by ${req.adminUser}`);
    res.json({ success: true, message: 'Restarting all ODS services...' });
    setTimeout(() => exec('sudo systemctl restart ods-kiosk ods-webserver ods-health-monitor ods-dpms-enforce.timer 2>/dev/null'), 1000);
});

// ─── Password Update ────────────────────────────────────────────────────────
router.post('/password', requireAdmin, (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    exec(`echo 'otter:${newPassword.replace(/'/g, "'\\''")}' | sudo chpasswd`, { timeout: 5000 }, (error) => {
        if (error) return res.status(500).json({ error: 'Failed to update password' });
        console.log(`[ADMIN] Password updated by ${req.adminUser}`);
        res.json({ success: true, message: 'Admin password updated' });
    });
});

// ─── SSH Toggle ─────────────────────────────────────────────────────────────
router.post('/ssh', requireAdmin, (req, res) => {
    const { enabled } = req.body;
    const action = enabled ? 'enable --now' : 'disable --now';
    exec(`systemctl ${action} ssh 2>/dev/null || systemctl ${action} sshd 2>/dev/null`, (error) => {
        if (error) return res.status(500).json({ error: 'Failed to toggle SSH' });
        console.log(`[ADMIN] SSH ${enabled ? 'enabled' : 'disabled'} by ${req.adminUser}`);
        res.json({ success: true, message: `SSH ${enabled ? 'enabled' : 'disabled'}` });
    });
});

// ─── Service Status ─────────────────────────────────────────────────────────
router.get('/services', requireAdmin, (req, res) => {
    exec('systemctl status ods-kiosk ods-webserver ods-dpms-enforce.timer ods-display-config ods-health-monitor --no-pager 2>&1', { timeout: 5000 }, (error, stdout) => {
        res.json({ status: stdout || 'Unable to query services' });
    });
});

// Export both router and middleware (requireAdmin may be needed by other routes)
module.exports = router;
module.exports.requireAdmin = requireAdmin;
