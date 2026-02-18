#!/bin/bash
# ODS Health Monitor — System health snapshots every 5 minutes
set -euo pipefail

LOG_DIR="/home/signage/ODS/logs/health"
PID_FILE="/home/signage/ODS/pids/ods_health_monitor.pid"
mkdir -p "$LOG_DIR"

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$1] $2" >> "$LOG_DIR/health_monitor.log"
}

collect_health_data() {
    local log_file="$LOG_DIR/health_$(date '+%Y%m%d_%H').log"

    {
        echo "=== SYSTEM HEALTH: $(date '+%Y-%m-%d %H:%M:%S') ==="
        echo "UPTIME: $(uptime -p 2>/dev/null || uptime)"
        echo "LOAD: $(cat /proc/loadavg)"

        echo "MEMORY:"
        free -h | sed 's/^/  /'

        echo "DISK:"
        df -h / | sed 's/^/  /'

        echo "TEMPERATURE:"
        local temp
        temp=$(cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null || echo "")
        if [ -n "$temp" ]; then
            echo "  CPU: $(echo "scale=1; $temp / 1000" | bc)°C"
        else
            echo "  No thermal data"
        fi

        echo "PROCESSES:"
        echo "  Chromium: $(pgrep -f chromium 2>/dev/null | wc -l) processes"
        echo "  Node.js: $(pgrep -f 'node ' 2>/dev/null | wc -l) processes"
        echo "  Xorg: $(pgrep -f Xorg > /dev/null 2>&1 && echo 'RUNNING' || echo 'STOPPED')"

        echo "NETWORK:"
        local ip
        ip=$(hostname -I 2>/dev/null | awk '{print $1}')
        echo "  IP: ${ip:-No IP}"
        echo "  DNS: $(nslookup google.com > /dev/null 2>&1 && echo 'OK' || echo 'FAILED')"
        echo "  Ethernet: $(ip link show end0 2>/dev/null | grep -q 'UP' && echo 'UP' || echo 'DOWN')"

        echo "CHROMIUM MEMORY:"
        local chrome_pids
        chrome_pids=$(pgrep -f chromium 2>/dev/null || true)
        if [ -n "$chrome_pids" ]; then
            local total_mem=0
            for pid in $chrome_pids; do
                local mem_kb
                mem_kb=$(grep "VmRSS:" "/proc/$pid/status" 2>/dev/null | awk '{print $2}' || echo "0")
                total_mem=$((total_mem + ${mem_kb:-0}))
            done
            echo "  Total: $((total_mem / 1024))MB across $(echo "$chrome_pids" | wc -w) processes"
        else
            echo "  No Chromium processes"
        fi

        echo "DISPLAY:"
        if [ -n "${DISPLAY:-}" ]; then
            echo "  Resolution: $(DISPLAY=:0 xrandr 2>/dev/null | grep '*' | head -1 | awk '{print $1}' || echo 'Unknown')"
        else
            echo "  No DISPLAY set"
        fi

        echo "RECENT ERRORS:"
        dmesg -l err,crit,alert,emerg 2>/dev/null | tail -3 | sed 's/^/  /' || echo "  None"

        echo "========================================"
    } >> "$log_file"
}

start_loop() {
    log_message "INFO" "Health monitoring started (PID: $$)"
    echo $$ > "$PID_FILE"

    while true; do
        collect_health_data
        # Clean logs older than 3 days
        find "$LOG_DIR" -name "health_*.log" -type f -mtime +3 -delete 2>/dev/null || true
        sleep 300
    done
}

stop_monitor() {
    if [ -f "$PID_FILE" ]; then
        local pid
        pid=$(cat "$PID_FILE")
        kill "$pid" 2>/dev/null && echo "Health monitor stopped (PID: $pid)" || echo "Not running"
        rm -f "$PID_FILE"
    else
        echo "Not running"
    fi
}

case "${1:-start}" in
    start) start_loop ;;
    stop) stop_monitor ;;
    status)
        if [ -f "$PID_FILE" ] && ps -p "$(cat "$PID_FILE")" > /dev/null 2>&1; then
            echo "RUNNING (PID: $(cat "$PID_FILE"))"
        else
            echo "NOT RUNNING"
        fi
        ;;
    *) echo "Usage: $0 {start|stop|status}" ;;
esac
