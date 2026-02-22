# ODS Atlas — Image Processes

> **Rule:** Insert creates Phase 0. Clone creates Phase 1. Never cross these.

---

## Phase 0: Insert (Base Golden Image)

**Purpose:** Create a fresh golden image from the base Armbian + our ODS instruction set.

**Tool:** `inject_atlas.sh` (loop-mount, inject, unmount)

**Process:**
1. Start with base Armbian image (`Armbian_26.2.1_Rpi4b_trixie_current_6.18.9_minimal.img`)
2. Run `inject_atlas.sh` on jdl-mini-box — injects `atlas_firstboot.sh`, `atlas-firstboot.service`, `atlas_secrets.conf`
3. Output: `ods-atlas-golden-vN-P-TAG.img`
4. Flash to SD card → firstboot runs → becomes a provisioned device

**When to use:**
- Building from scratch (new Armbian base)
- After updating `atlas_firstboot.sh` with new architecture
- Re-establishing the origin point after a development sprint

**Never use for:**
- Cloning a running dev device
- Creating Phase 1 images

**Commands:**
```bash
# On jdl-mini-box
cd ~/atlas-build
sudo -A bash scripts/inject_atlas.sh \
  /home/jones-dev-lab/atlas-build/Armbian_26.2.1_Rpi4b_trixie_current_6.18.9_minimal.img \
  /home/jones-dev-lab/atlas-build/ods-atlas-golden-vN-P-TAG.img
```

---

## Phase 1: Clone (Dev Device Snapshot)

**Purpose:** Create an exact copy of a running/configured SD card for backup or deployment.

**Tool:** `partclone` + `sfdisk` + `pigz` (partition-level clone with compression)

**Process:**
1. Insert source SD card into jdl-mini-box USB reader
2. Unmount all partitions
3. `sfdisk --dump` → save partition table
4. `partclone.fat32 -c` → clone boot partition (compressed via pigz)
5. `partclone.ext4 -c` → clone root partition (compressed via pigz)
6. Output: directory with `partition-table.dump`, `sdc1-boot.partclone.gz`, `sdc2-root.partclone.gz`

**When to use:**
- Snapshotting a dev device after a milestone (safety net)
- Creating a Phase 1 golden image for deployment (after firstboot completes)
- Preserving a known-good state before risky changes

**Never use for:**
- Creating Phase 0 base images (use inject instead)

### Clone (capture)
```bash
# On jdl-mini-box — source SD card in reader
CLONE_DIR=~/atlas-build/golden-clone-TAG
mkdir -p "$CLONE_DIR"
sudo umount /dev/sdc* 2>/dev/null
sudo sfdisk --dump /dev/sdc > "$CLONE_DIR/partition-table.dump"
sudo partclone.fat32 -c -s /dev/sdc1 | pigz > "$CLONE_DIR/sdc1-boot.partclone.gz"
sudo partclone.ext4 -c -s /dev/sdc2 | pigz > "$CLONE_DIR/sdc2-root.partclone.gz"
cp ~/atlas-build/golden-clone/restore_golden.sh "$CLONE_DIR/"
```

### Restore (deploy)
```bash
# On jdl-mini-box — target SD card in reader
sudo bash ~/atlas-build/golden-clone-TAG/restore_golden.sh /dev/sdc
```

The restore script:
1. Unmounts target partitions
2. Restores partition table via `sfdisk`
3. Restores boot (FAT32) via `partclone.fat32 -r`
4. Restores root (ext4) via `partclone.ext4 -r`
5. Grows root partition to fill all available SD card space

---

## Phase Lifecycle

```
Phase 0 (Insert)     Phase 1 (Clone)      Phase 2 (Boot)       Phase 3 (Boot)
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Base Armbian  │    │ Provisioned  │    │ Enrollment   │    │ Production   │
│ + firstboot   │───▶│ golden image │───▶│ sealed splash│───▶│ v8-0-6-FLASH │
│ inject_atlas  │    │ partclone    │    │ mgmt server  │    │ kiosk mode   │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
    inject_atlas.sh     partclone clone     ods-enrollment-boot   ods-kiosk-wrapper
                        + restore           (no Chromium/Xorg)    (full boot pipeline)
```

## Safety Net Clones (Dev Sprint Pattern)

During rapid development, use the clone process to create safety nets:

```bash
# Before risky changes
golden-clone-v8-0-6-FLASH/     # Dev device snapshot (safety net)

# After successful milestone
golden-clone-v8-1-0-FEATURE/   # New feature verified, snapshot saved
```

**Sprint pattern:** Develop → Verify → Clone → Develop → Verify → Clone

This ensures you can always roll back to the last known-good state without rebuilding from Phase 0.

---

## Storage Locations

| Location | Purpose |
|----------|---------|
| `~/atlas-build/` on jdl-mini-box | Active builds and clones |
| `~/Desktop/` on Mac | Staging (one image at a time) |
| `/Volumes/NVME_VAULT/golden-atlas-img/` | Permanent archive |

## Key Files

| File | Location | Purpose |
|------|----------|---------|
| `inject_atlas.sh` | `scripts/` in repo | Phase 0 image builder |
| `atlas_firstboot.sh` | `scripts/` in repo | Firstboot provisioning |
| `restore_golden.sh` | `golden-clone*/` on jdl-mini-box | Phase 1 clone restore |
| `atlas_secrets.conf` | `~/atlas-build/scripts/` on jdl-mini-box | Credentials (NOT in git) |
