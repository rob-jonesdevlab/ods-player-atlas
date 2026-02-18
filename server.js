const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const QRCode = require('qrcode');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// ========================================
// NETWORK APIs
// ========================================

// Get network status
app.get('/api/status', (req, res) => {
    exec('iwgetid -r', (error, stdout) => {
        const ssid = stdout.trim();
        const wifi_connected = !!ssid;

        exec('ip route | grep default', (error, stdout) => {
            // Check for both eth0 (standard) and end0 (Armbian Pi5)
            const ethernet_connected = stdout.includes('eth0') || stdout.includes('end0');

            res.json({
                wifi_connected,
                ethernet_connected,
                ssid: ssid || null
            });
        });
    });
});

// Configure WiFi
app.post('/api/wifi/configure', (req, res) => {
    const { ssid, password } = req.body;

    const wpaConfig = `
network={
    ssid="${ssid}"
    psk="${password}"
}
`;

    exec(`echo '${wpaConfig}' >> /etc/wpa_supplicant/wpa_supplicant.conf`, (error) => {
        if (error) {
            return res.status(500).json({ error: 'Failed to configure WiFi' });
        }

        exec('wpa_cli -i wlan0 reconfigure', (error) => {
            if (error) {
                return res.status(500).json({ error: 'Failed to restart WiFi' });
            }

            res.json({ success: true });
        });
    });
});

// Generate QR code
app.get('/api/qr', async (req, res) => {
    const setupUrl = `http://${req.hostname}:8080/setup.html`;
    const qrCode = await QRCode.toDataURL(setupUrl, { width: 400 });
    res.json({ qrCode });
});

// Trigger enrollment
app.post('/api/enroll', (req, res) => {
    exec('python3 /usr/local/bin/device_uuid_generator.py 209.38.118.127 9999', (error, stdout) => {
        if (error) {
            return res.status(500).json({ error: 'Enrollment failed' });
        }
        res.json({ success: true, output: stdout });
    });
});

// ========================================
// LOADER API
// ========================================

// Signal that loader is ready (Plymouth can quit)
app.get('/api/loader-ready', (req, res) => {
    const signalFile = '/tmp/ods-loader-ready';
    fs.writeFileSync(signalFile, Date.now().toString());
    console.log('[LOADER] Ready signal received — Plymouth can quit');
    res.json({ success: true });
});

// ========================================
// SYSTEM APIs
// ========================================

// System info
app.get('/api/system/info', (req, res) => {
    const info = {};
    const commands = {
        hostname: 'hostname',
        cpu_temp: "cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null",
        uptime: 'uptime -p',
        ram: "free -h | awk '/^Mem:/ {print $3 \"/\" $2}'",
        ram_percent: "free | awk '/^Mem:/ {printf \"%.0f\", $3/$2*100}'",
        storage: "df -h / | awk 'NR==2 {print $3 \"/\" $2}'",
        storage_percent: "df / | awk 'NR==2 {print $5}' | tr -d '%'",
        os_version: 'cat /etc/armbian-release 2>/dev/null | grep VERSION= | cut -d= -f2 || lsb_release -d -s',
        ip_address: "hostname -I | awk '{print $1}'",
        dns: "cat /etc/resolv.conf | grep nameserver | head -1 | awk '{print $2}'",
        interfaces: "ip -br addr show",
        display_resolution: "DISPLAY=:0 xrandr 2>/dev/null | grep '[*]' | head -1 | awk '{print $1}'",
        display_scale: "echo $ODS_SCALE"
    };

    let completed = 0;
    const total = Object.keys(commands).length;

    for (const [key, cmd] of Object.entries(commands)) {
        exec(cmd, { timeout: 3000 }, (error, stdout) => {
            let value = stdout ? stdout.trim() : '—';

            // Convert CPU temp from millidegrees
            if (key === 'cpu_temp' && value !== '—' && !isNaN(value)) {
                value = (parseInt(value) / 1000).toFixed(1) + '°C';
            }

            info[key] = value;
            completed++;

            if (completed === total) {
                res.json({
                    hostname: info.hostname,
                    cpu_temp: info.cpu_temp,
                    uptime: info.uptime,
                    ram_usage: info.ram,
                    ram_percent: parseInt(info.ram_percent) || 0,
                    storage_usage: info.storage,
                    storage_percent: parseInt(info.storage_percent) || 0,
                    os_version: info.os_version,
                    ip_address: info.ip_address,
                    dns: info.dns,
                    interfaces: info.interfaces,
                    display_resolution: info.display_resolution,
                    display_scale: info.display_scale || '1'
                });
            }
        });
    }
});

// System actions
app.post('/api/system/reboot', (req, res) => {
    res.json({ success: true, message: 'Rebooting in 3 seconds...' });
    setTimeout(() => exec('reboot'), 3000);
});

app.post('/api/system/shutdown', (req, res) => {
    res.json({ success: true, message: 'Shutting down in 3 seconds...' });
    setTimeout(() => exec('shutdown -h now'), 3000);
});

app.post('/api/system/cache-clear', (req, res) => {
    exec('rm -rf /home/signage/.config/chromium/Default/Cache/* /home/signage/.config/chromium/Default/Code\\ Cache/*', (error) => {
        if (error) return res.status(500).json({ error: 'Failed to clear cache' });
        res.json({ success: true, message: 'Browser cache cleared. Restart to take effect.' });
    });
});

app.post('/api/system/factory-reset', (req, res) => {
    res.json({ success: true, message: 'Factory reset initiated...' });
    setTimeout(() => {
        exec('rm -rf /home/signage/.config/chromium && reboot');
    }, 2000);
});

// System logs
app.get('/api/system/logs', (req, res) => {
    exec('journalctl -n 100 --no-pager -u ods-kiosk -u ods-webserver 2>/dev/null || tail -100 /var/log/ods-kiosk.log', (error, stdout) => {
        res.json({ logs: stdout || 'No logs available' });
    });
});

// ========================================
// START SERVER
// ========================================
app.listen(8080, () => {
    console.log('[SETUP] ODS Player OS server running on port 8080');
});
