# ODS Player OS Atlas — Version History

All golden images are archived at `/Volumes/NVME_VAULT/golden-atlas-img/`.
Build server: `jdl-mini-box` (`10.111.123.134`).

## Naming Convention

```
ods-atlas-golden-vMAJOR-PATCH-TAG.img
```

| Component | Value | Example |
|-----------|-------|---------|
| `ods-atlas-golden` | Project prefix | — |
| `vMAJOR` | Major version (sequential) | `v7` |
| `PATCH` | Patch number within major (0 = initial release) | `1` |
| `TAG` | Human-readable milestone (ALLCAPS) | `OPENBOX` |

### Rules

1. **Immutable** — every build is a unique file, never overwritten
2. **Desktop = staging** — delete old version before placing new one
3. **NVME_VAULT = archive** — permanent storage, all builds preserved
4. **jdl-mini-box = build server** — may retain only latest build per major

---

## Version History

| Version | File | Date | Size |
|---------|------|------|------|
| v1-0 | `ods-atlas-golden-v1-0-INITIAL.img` | 2026-02-16 | 1.0G |
| v2-0 | `ods-atlas-golden-v2-0-SECURE.img` | 2026-02-16 | 1.0G |
| v3-0 | `ods-atlas-golden-v3-0-PRODUCTION.img` | 2026-02-16 | 775M |
| v4-0 | `ods-atlas-golden-v4-0-LEGACY.img` | 2026-02-16 | 1.0G |
| v5-0 | `ods-atlas-golden-v5-0-NATIVE.img` | 2026-02-16 | 1.0G |
| v6-0 | `ods-atlas-golden-v6-0-SPLASH.img` | 2026-02-18 | 1.8G |
| v7-0 | `ods-atlas-golden-v7-0-OPENBOX.img` | 2026-02-21 | 1.8G |
| **v7-1** | `ods-atlas-golden-v7-1-OPENBOX.img` | 2026-02-21 | 1.8G |
| **v7-2** | **`ods-atlas-golden-v7-2-OPENBOX.img`** | **2026-02-21** | **1.8G** |

See individual release notes in `v*.md` files.
