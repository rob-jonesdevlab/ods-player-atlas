#!/bin/bash
# ============================================================
# ods-system-update.sh — Cloud-triggered OTA update orchestrator
# ============================================================
# Called by cloud-sync.js when a 'deploy_system_update' event arrives.
# Reports progress phases to localhost:8080/api/system/update-status
# which cloud-sync.js relays to Archaeopteryx via Socket.IO.
#
# Phases: downloading → deploying → restarting → complete / failed
# Logs to: /home/signage/ODS/logs/update/
# ============================================================

set -euo pipefail

ODS="/home/signage/ODS"
LOG_DIR="$ODS/logs/update"
LOG="$LOG_DIR/update_$(date +%Y%m%d_%H%M%S).log"
VERSION_FILE="$ODS/VERSION"

# Create log directory
mkdir -p "$LOG_DIR"

# Redirect all output to log file + stdout
exec > >(tee -a "$LOG") 2>&1

echo "=== ODS System Update Started: $(date) ==="

# ─── Status Reporter ────────────────────────────────────────────────────────
report_status() {
    local status="$1"
    local detail="$2"
    echo "[UPDATE] Status: $status — $detail"
    curl -sf -X POST http://localhost:8080/api/system/update-status \
        -H 'Content-Type: application/json' \
        -d "{\"status\":\"$status\",\"detail\":\"$detail\"}" 2>/dev/null || true
}

# ─── Error Trap ──────────────────────────────────────────────────────────────
on_error() {
    local exit_code=$?
    local line_no=$1
    report_status "failed" "Error on line $line_no (exit code $exit_code)"
    echo "=== ODS System Update FAILED: $(date) ==="
    exit $exit_code
}
trap 'on_error $LINENO' ERR

# ─── Phase 1: Download ──────────────────────────────────────────────────────
report_status "downloading" "Pulling latest from origin"

cd "$ODS"

# Stash any local modifications (shouldn't happen, but be safe)
git stash --quiet 2>/dev/null || true

git pull origin main 2>&1
PULL_RESULT=$?

if [ $PULL_RESULT -ne 0 ]; then
    report_status "failed" "git pull failed with exit code $PULL_RESULT"
    exit 1
fi

NEW_VERSION=$(cat "$VERSION_FILE" 2>/dev/null || echo "unknown")
echo "[UPDATE] New version: $NEW_VERSION"

# ─── Phase 2: Deploy System Scripts ─────────────────────────────────────────
report_status "deploying" "Installing system scripts (v$NEW_VERSION)"

# Core boot scripts
for script in \
    ods-player-boot-wrapper.sh \
    start-player-ATLAS.sh \
    ods-display-config.sh \
    ods-auth-check.sh \
    ods-hostname.sh \
    hide-tty.sh; do
    if [ -f "$ODS/scripts/$script" ]; then
        sudo cp "$ODS/scripts/$script" /usr/local/bin/
        sudo chmod +x "/usr/local/bin/$script"
        echo "[UPDATE] Deployed: $script"
    fi
done

# Service units (only copy if they exist in the repo)
for service in \
    ods-display-config.service \
    ods-dpms-enforce.service \
    ods-enrollment-retry.service; do
    if [ -f "$ODS/scripts/services/$service" ]; then
        sudo cp "$ODS/scripts/services/$service" /etc/systemd/system/
        echo "[UPDATE] Service deployed: $service"
    fi
done

# Reload systemd if any service files were updated
sudo systemctl daemon-reload 2>/dev/null || true

# Install npm dependencies if package.json changed
if git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -q 'package.json'; then
    echo "[UPDATE] package.json changed — running npm install"
    cd "$ODS" && npm install --production 2>&1
fi

# ─── Phase 3: Restart Services ──────────────────────────────────────────────
report_status "restarting" "Restarting ODS services"

# Restart webserver first (it hosts the status endpoint)
sudo systemctl restart ods-webserver 2>/dev/null || true

# Brief pause to let webserver come back up
sleep 2

# Restart the player service
sudo systemctl restart ods-player-ATLAS 2>/dev/null || true

# ─── Phase 4: Complete ──────────────────────────────────────────────────────
# Wait for services to stabilise
sleep 3

report_status "complete" "$NEW_VERSION"
echo "=== ODS System Update COMPLETE: $(date) — v$NEW_VERSION ==="

# Clean up old logs (keep last 10)
ls -t "$LOG_DIR"/update_*.log 2>/dev/null | tail -n +11 | xargs -r rm -f
