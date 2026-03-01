# v9-0 ORIGIN — Image Pipeline Overhaul

**Date Range:** February 24, 2026  
**Images:** v9-0-0-ORIGIN  
**Codename:** ORIGIN

---

## Overview

The v9-0 ORIGIN release rebuilt the image creation pipeline from scratch: `inject_atlas.sh` replaced manual golden image building, `atlas_firstboot.sh` was rewritten as an 11-step automated provisioning script, and the P:0 → P:3 lifecycle was formalized.

## Key Changes

| Area | Change |
|------|--------|
| inject_atlas.sh | Loop-mount base Armbian → inject firstboot + service + secrets → golden image |
| atlas_firstboot.sh | 11-step automated provisioning (~1400 lines) — packages, users, deploy, services |
| P:0 lifecycle | Formalized Insert → Clone → Enrollment → Production pipeline |
| Armbian bypass | Pre-set root password, mask armbian-firstrun, remove gate file at inject time |
| Boot partition | cmdline.txt patched (consoleblank=0, splash quiet, plymouth, cursor hide) |
| Phase selector | `ods-phase-selector.sh` gates boot into Phase 2 (enrollment) vs Phase 3 (production) |
| Service architecture | 12 systemd services deployed from firstboot |

## Image Pipeline

```
P:0 (Insert)         P:1 (Clone)          P:2 (Enrollment)     P:3 (Production)
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Base Armbian  │    │ Provisioned  │    │ Enrollment   │    │ Production   │
│ + firstboot   │───▶│ golden image │───▶│ sealed splash│───▶│ Player OS    │
│ inject_atlas  │    │ partclone    │    │ mgmt server  │    │ full boot    │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```
