/**
 * routes/network.js — Network, WiFi, and Display routes for ODS Player Atlas
 *
 * Extracted from monolithic server.js. Handles:
 *  - Network status (per-interface details)
 *  - WiFi scanning, configuration, connection state machine
 *  - WiFi toggle and state
 *  - Display modes and monitor info
 *  - Static IP / DHCP configuration
 */

const express = require('express');
const { exec } = require('child_process');
const os = require('os');
const router = express.Router();

// ─── WiFi Connection State ──────────────────────────────────────────────────
// Shared mutable state: polled by network_setup.html for status pill updates
let wifiConnectionState = { stage: 'idle', message: '', ssid: '', ip: '' };

// ─── Network Status ─────────────────────────────────────────────────────────
router.get('/status', (req, res) => {
    exec('iwgetid -r', (error, stdout) => {
        const iwgetidSsid = (stdout || '').trim();

        const checkWifi = (callback) => {
            if (iwgetidSsid) return callback(iwgetidSsid, true);
            exec('sudo wpa_cli -i wlan0 status 2>/dev/null', { timeout: 3000 }, (e, wpaOut) => {
                const wpaState = (wpaOut || '').match(/wpa_state=(\S+)/);
                const wpaSsid = (wpaOut || '').match(/^ssid=(.+)$/m);
                if (wpaState && wpaState[1] === 'COMPLETED' && wpaSsid) {
                    callback(wpaSsid[1], true);
                } else {
                    callback('', false);
                }
            });
        };

        checkWifi((ssid, wifi_connected) => {
            exec('ip route | grep default', (error, stdout) => {
                const routeOutput = (stdout || '');
                const ethernet_connected = routeOutput.includes('eth0') || routeOutput.includes('end0');
                const hasInternet = wifi_connected || ethernet_connected;
                const ethIface = routeOutput.includes('end0') ? 'end0' : 'eth0';

                const getIfaceDetails = (iface, callback) => {
                    exec(`ip -4 addr show ${iface} 2>/dev/null | grep inet`, (e, ipOut) => {
                        const ipMatch = (ipOut || '').match(/inet\s+([\d.]+)\/([\d]+)/);
                        const ip = ipMatch ? ipMatch[1] : null;
                        const subnet = ipMatch ? ipMatch[2] : null;

                        exec(`ip route | grep "default.*${iface}" | awk '{print $3}'`, (e, gwOut) => {
                            const gateway = (gwOut || '').trim() || null;

                            exec(`ps aux | grep -E "dhclient.*${iface}|dhcpcd.*${iface}|NetworkManager" | grep -v grep`, (e, dhcpOut) => {
                                const isDhcp = !!(dhcpOut || '').trim();
                                callback({ ip, subnet, gateway, dhcp: isDhcp ? 'DHCP' : 'Static' });
                            });
                        });
                    });
                };

                exec('grep "^nameserver" /etc/resolv.conf | head -2 | awk \'{print $2}\' | paste -sd ", "', (e, dnsOut) => {
                    const dns = (dnsOut || '').trim() || null;

                    getIfaceDetails(ethIface, (ethDetails) => {
                        getIfaceDetails('wlan0', (wifiDetails) => {
                            res.json({
                                hostname: os.hostname(),
                                wifi_connected,
                                ethernet_connected,
                                hasInternet,
                                ssid: ssid || null,
                                ethernet: {
                                    connected: ethernet_connected,
                                    interface: ethIface,
                                    ip: ethDetails.ip,
                                    subnet: ethDetails.subnet,
                                    gateway: ethDetails.gateway,
                                    dns: dns,
                                    type: ethDetails.dhcp
                                },
                                wifi: {
                                    connected: wifi_connected,
                                    interface: 'wlan0',
                                    ssid: ssid || null,
                                    ip: wifiDetails.ip,
                                    subnet: wifiDetails.subnet,
                                    gateway: wifiDetails.gateway,
                                    dns: dns,
                                    type: wifiDetails.dhcp
                                },
                                ip_address: ethDetails.ip || wifiDetails.ip || null,
                                dns: dns
                            });
                        });
                    });
                });
            });
        });
    });
});

// ─── WiFi Scan ──────────────────────────────────────────────────────────────
router.get('/wifi/scan', (req, res) => {
    exec('pgrep -x hostapd', { timeout: 2000 }, (err) => {
        if (!err) {
            return res.json({ networks: [], ap_active: true });
        }
        exec('sudo ip link set wlan0 up 2>/dev/null; sleep 2; sudo iw dev wlan0 scan 2>/dev/null | grep -E "SSID:|signal:" | paste - - 2>/dev/null', { timeout: 25000 }, (error, stdout) => {
            const networks = [];
            if (stdout && stdout.trim()) {
                const lines = stdout.trim().split('\n');
                lines.forEach(line => {
                    const ssidMatch = line.match(/SSID:\s*(.+?)(?:\s|$)/);
                    const signalMatch = line.match(/signal:\s*(-?[\d.]+)/);
                    if (ssidMatch && ssidMatch[1] && ssidMatch[1] !== '\\x00') {
                        networks.push({
                            ssid: ssidMatch[1].trim(),
                            signal: signalMatch ? parseFloat(signalMatch[1]) : -100
                        });
                    }
                });
            }
            const unique = [...new Map(networks.map(n => [n.ssid, n])).values()];
            unique.sort((a, b) => b.signal - a.signal);
            res.json({ networks: unique });
        });
    });
});

// ─── Display Modes ──────────────────────────────────────────────────────────
router.get('/display/modes', (req, res) => {
    exec("DISPLAY=:0 xrandr 2>/dev/null | grep -E '^\\s+[0-9]+x[0-9]+' | awk '{print $1}' | sort -t x -k1 -rn | uniq", { timeout: 5000 }, (error, stdout) => {
        const modes = stdout ? stdout.trim().split('\n').filter(m => m.match(/^\d+x\d+$/)) : [];
        res.json({ modes });
    });
});

// ─── Display Monitors ───────────────────────────────────────────────────────
router.get('/display/monitors', (req, res) => {
    exec("DISPLAY=:0 xrandr --query 2>/dev/null", { timeout: 5000 }, (error, stdout) => {
        if (error || !stdout) {
            return res.json({ monitors: [], count: 0 });
        }

        const monitors = [];
        const lines = stdout.split('\n');
        let currentMonitor = null;

        lines.forEach(line => {
            const outputMatch = line.match(/^(\S+)\s+(connected|disconnected)\s*(primary)?\s*(\d+x\d+\+\d+\+\d+)?\s*(.*)/);
            if (outputMatch) {
                if (currentMonitor) monitors.push(currentMonitor);
                const [, name, status, primary, geometry] = outputMatch;
                currentMonitor = {
                    name,
                    connected: status === 'connected',
                    primary: !!primary,
                    geometry: geometry || null,
                    resolution: geometry ? geometry.split('+')[0] : null,
                    position: geometry ? { x: parseInt(geometry.split('+')[1]), y: parseInt(geometry.split('+')[2]) } : null,
                    modes: [],
                    currentMode: null
                };
            } else if (currentMonitor && line.match(/^\s+\d+x\d+/)) {
                const modeMatch = line.match(/^\s+(\d+x\d+)\s+([\d.]+)(\*)?(\+)?/);
                if (modeMatch) {
                    const mode = { resolution: modeMatch[1], refresh: parseFloat(modeMatch[2]), current: !!modeMatch[3], preferred: !!modeMatch[4] };
                    currentMonitor.modes.push(mode);
                    if (mode.current) currentMonitor.currentMode = mode;
                }
            }
        });
        if (currentMonitor) monitors.push(currentMonitor);

        const connected = monitors.filter(m => m.connected);
        res.json({ monitors: connected, count: connected.length });
    });
});

// ─── WiFi Connection Status ─────────────────────────────────────────────────
router.get('/wifi/connection-status', (req, res) => {
    res.json(wifiConnectionState);
});

// ─── WiFi Configure ─────────────────────────────────────────────────────────
router.post('/wifi/configure', (req, res) => {
    const { ssid, password } = req.body;
    if (!ssid) return res.status(400).json({ error: 'SSID required' });

    const wpaHeader = `ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev\nupdate_config=1\ncountry=US\n`;
    const wpaNetwork = password
        ? `\nnetwork={\n    ssid="${ssid}"\n    psk="${password}"\n}\n`
        : `\nnetwork={\n    ssid="${ssid}"\n    key_mgmt=NONE\n}\n`;
    const wpaFull = wpaHeader + wpaNetwork;

    exec(`echo '${wpaFull}' | sudo tee /etc/wpa_supplicant/wpa_supplicant.conf > /dev/null`, (error) => {
        if (error) {
            wifiConnectionState = { stage: 'failed', message: 'Failed to save credentials', ssid, ip: '' };
            return res.status(500).json({ error: 'Failed to configure WiFi' });
        }

        wifiConnectionState = { stage: 'configuring', message: 'Config received...', ssid, ip: '' };
        res.json({ success: true, message: `Credentials saved. Connecting to ${ssid}...` });

        console.log(`[WiFi] Credentials saved for "${ssid}" — stopping AP in 2s...`);
        setTimeout(() => {
            const teardown = [
                'sudo killall hostapd 2>/dev/null',
                'sudo killall dnsmasq 2>/dev/null',
                'sudo killall wpa_supplicant 2>/dev/null',
                'sudo ip addr flush dev wlan0 2>/dev/null',
                'sleep 1',
                'sudo ip link set wlan0 up',
                'sleep 1',
                'sudo wpa_supplicant -B -i wlan0 -c /etc/wpa_supplicant/wpa_supplicant.conf'
            ].join(' ; ');

            wifiConnectionState = { stage: 'connecting', message: 'Connecting to network...', ssid, ip: '' };

            exec(teardown, { timeout: 15000 }, (err, stdout, stderr) => {
                console.log(`[WiFi] AP torn down, wpa_supplicant started. stdout: ${(stdout || '').trim()}`);

                setTimeout(() => {
                    exec('sudo wpa_cli -i wlan0 status 2>/dev/null', { timeout: 5000 }, (e, statusOut) => {
                        console.log(`[WiFi] wpa_cli status: ${(statusOut || '').trim().replace(/\n/g, ' | ')}`);

                        exec('sudo wpa_cli -i wlan0 reconfigure 2>/dev/null', { timeout: 5000 }, () => {
                            setTimeout(() => {
                                wifiConnectionState = { stage: 'obtaining_ip', message: 'Obtaining IP address...', ssid, ip: '' };

                                exec('sudo busybox udhcpc -i wlan0 -n -q 2>/dev/null', { timeout: 15000 }, (dhcpErr, dhcpOut) => {
                                    console.log(`[WiFi] DHCP result: ${(dhcpOut || '').trim()}`);

                                    setTimeout(() => {
                                        exec('sudo wpa_cli -i wlan0 status 2>/dev/null', (err, finalStatus) => {
                                            const lines = (finalStatus || '');
                                            const stateMatch = lines.match(/wpa_state=(\S+)/);
                                            const ssidMatch = lines.match(/ssid=(\S+)/);
                                            const ipMatch = lines.match(/ip_address=(\S+)/);
                                            const state = stateMatch ? stateMatch[1] : 'UNKNOWN';
                                            const connSsid = ssidMatch ? ssidMatch[1] : 'none';
                                            const ip = ipMatch ? ipMatch[1] : '';

                                            if (state === 'COMPLETED') {
                                                console.log(`[WiFi] ✓ Connected to "${connSsid}" (IP: ${ip})`);
                                                wifiConnectionState = { stage: 'connected', message: 'Connected', ssid: connSsid, ip };
                                            } else {
                                                console.log(`[WiFi] ✗ Failed — state=${state}, ssid=${connSsid}. Restarting AP...`);
                                                wifiConnectionState = { stage: 'failed', message: 'Connection failed', ssid, ip: '' };
                                                setTimeout(() => {
                                                    wifiConnectionState = { stage: 'restarting', message: 'Please try again...', ssid, ip: '' };
                                                    exec('sudo killall wpa_supplicant 2>/dev/null; sudo systemctl start ods-setup-ap', (e) => {
                                                        if (e) console.error('[WiFi] Failed to restart AP:', e.message);
                                                        else console.log('[WiFi] AP restarted — user can try again');
                                                        setTimeout(() => {
                                                            wifiConnectionState = { stage: 'idle', message: '', ssid: '', ip: '' };
                                                        }, 5000);
                                                    });
                                                }, 3000);
                                            }
                                        });
                                    }, 5000);
                                });
                            }, 5000);
                        });
                    });
                }, 10000);
            });
        }, 2000);
    });
});

// ─── WiFi Toggle ────────────────────────────────────────────────────────────
router.post('/wifi/toggle', (req, res) => {
    const { enabled } = req.body;
    const cmd = enabled ? 'sudo ip link set wlan0 up 2>&1' : 'sudo ip link set wlan0 down 2>&1';
    exec(cmd, { timeout: 5000 }, (error) => {
        if (error) return res.status(500).json({ error: 'Failed to toggle WiFi' });
        res.json({ success: true, enabled, message: `WiFi ${enabled ? 'enabled' : 'disabled'}` });
    });
});

// ─── WiFi State ─────────────────────────────────────────────────────────────
router.get('/wifi/state', (req, res) => {
    exec("pgrep -x hostapd", { timeout: 2000 }, (apErr) => {
        if (!apErr) {
            return res.json({ enabled: false, ap_mode: true });
        }
        exec("ip link show wlan0 2>/dev/null | head -1", { timeout: 3000 }, (error, stdout) => {
            const up = stdout && stdout.includes('UP');
            res.json({ enabled: up, ap_mode: false });
        });
    });
});

// ─── Network Configure (Static IP / DHCP) ──────────────────────────────────
router.post('/network/configure', (req, res) => {
    const { interface: iface, mode, ip, subnet, gateway, dns } = req.body;

    let linuxIface;
    if (iface === 'ethernet') {
        try {
            require('child_process').execSync('ip link show end0 2>/dev/null');
            linuxIface = 'end0';
        } catch {
            linuxIface = 'eth0';
        }
    } else if (iface === 'wifi') {
        linuxIface = 'wlan0';
    } else {
        return res.status(400).json({ error: 'Invalid interface' });
    }

    if (mode === 'dhcp') {
        exec(`sudo ip addr flush dev ${linuxIface} && sudo dhclient ${linuxIface} 2>/dev/null`, { timeout: 15000 }, (error) => {
            if (error) return res.status(500).json({ error: 'Failed to switch to DHCP' });
            res.json({ success: true, message: `${iface} switched to DHCP` });
        });
        return;
    }

    if (!ip || !subnet || !gateway) {
        return res.status(400).json({ error: 'IP, Subnet, and Gateway are required for static config' });
    }

    function subnetToCidr(mask) {
        if (/^\d+$/.test(mask)) return mask;
        return mask.split('.').reduce((c, o) => c + (parseInt(o) >>> 0).toString(2).split('1').length - 1, 0);
    }
    const cidr = subnetToCidr(subnet);

    const cmds = [
        `sudo ip addr flush dev ${linuxIface}`,
        `sudo ip addr add ${ip}/${cidr} dev ${linuxIface}`,
        `sudo ip link set ${linuxIface} up`,
        `sudo ip route add default via ${gateway} dev ${linuxIface} 2>/dev/null || sudo ip route replace default via ${gateway} dev ${linuxIface}`
    ];

    if (dns) {
        cmds.push(`echo 'nameserver ${dns}' | sudo tee /etc/resolv.conf > /dev/null`);
    }

    const fullCmd = cmds.join(' && ');
    console.log(`[NET] Applying static config to ${linuxIface}: ${ip}/${cidr} gw ${gateway} dns ${dns || 'unchanged'}`);

    exec(fullCmd, { timeout: 10000 }, (error, stdout, stderr) => {
        if (error) {
            console.error(`[NET] Static config failed:`, stderr);
            return res.status(500).json({ error: 'Failed to apply static config: ' + (stderr || error.message) });
        }
        console.log(`[NET] Static config applied to ${linuxIface}`);
        res.json({ success: true, message: `Static IP ${ip}/${cidr} applied to ${iface}` });
    });
});

module.exports = router;
