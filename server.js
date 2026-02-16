const express = require('express');
const { exec } = require('child_process');
const QRCode = require('qrcode');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// Get network status
app.get('/api/status', (req, res) => {
    exec('iwgetid -r', (error, stdout) => {
        const ssid = stdout.trim();
        const wifi_connected = !!ssid;

        exec('ip route | grep default', (error, stdout) => {
            const ethernet_connected = stdout.includes('eth0');

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

app.listen(8080, () => {
    console.log('[SETUP] WiFi setup server running on port 8080');
});
