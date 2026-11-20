# RELEASE-001 Step 4B — Post–Step 4 failure production backup

**Recorded:** 2026-11-20  
**Production:** `txfxeehglqfszletuumn`  
**GitHub `main`:** `570b223f22b855f703c48d5da5504d92a5c5125f`  
**Machine evidence:** [`deployment-evidence/2026-11-20-production-backup-post-step4-fail.json`](deployment-evidence/2026-11-20-production-backup-post-step4-fail.json)

## Verdict: **PASS**

| Check | Result |
|-------|--------|
| Identity (`BACKUP_DATABASE_URL`) | **`supabase:txfxeehglqfszletuumn/postgres`** |
| Staging collision | **None** |
| Ledger preflight | **11** finished, **1** unresolved, **`batch24` unresolved = 1** |
| Schema marker | `ChangeRequestCategory` **present** (post-drift state) |
| Encrypted artifact | **New** timestamped `.dump.gpg` (did **not** overwrite pre-migrate backup) |
| GPG decrypt + `pg_restore --list` | **PASS** |
| SHA-256 / size recorded | In evidence JSON |
| Pre-migrate backup | **Preserved** — SHA-256 unchanged vs Step 2 record |
| `migrate deploy` / `resolve` / restore | **Not executed** |

## Artifacts (no secrets in repo)

| Role | Location |
|------|----------|
| **Pre-migrate (Step 2)** | `C:\Users\user\AppData\Local\WebXXL-SecureBackups\webxxl-txfx-pooler-pre-migrate-2026-11-20T18-28-33-994Z.dump.gpg` |
| **Post–Step 4 fail (Step 4B)** | `C:\Users\user\AppData\Local\WebXXL-SecureBackups\webxxl-txfx-pooler-post-step4-fail-2026-11-20T19-39-21-194Z.dump.gpg` |
| **Step 4B passphrase** | `…post-step4-fail-2026-11-20T19-39-21-194Z.gpg-passphrase.bin` (co-located; **not** in Git) |

**Step 4B SHA-256:** `44aed9eb9fa54964bd2dd90a6f506916e85c5e5783b1e09f595278b5b67d58fd` (**103,109** bytes)

**Step 2 SHA-256 (unchanged):** `1cf20467f7fbed1efbfdda0eb626e1c388f6634fbfb8604d6e18f8bd7fd659e8`

## Passphrase handling

- **Local:** new `.gpg-passphrase.bin` beside the new `.dump.gpg` (existing pre-migrate passphrase file **untouched**).
- **Recommended separate copy:** store the Step 4B passphrase in **Windows Credential Manager** or your password manager under a dedicated label (e.g. `WebXXL-txfx-post-step4-fail-2026-11-20`); optional second offline copy on removable media. **Do not** delete or relocate the Step 2 passphrase without explicit authorization.

## Ready for production repair?

| | |
|--|--|
| **Backup gate (Step 4B)** | **GO** — post-failure snapshot verified |
| **Live `migrate resolve` + `deploy`** | **NO-GO** — still requires **separate explicit owner authorization** (runbook: [`RELEASE-001-STEP4A-REHEARSAL-RESULT.md`](RELEASE-001-STEP4A-REHEARSAL-RESULT.md)) |

## Related

- Step 2 backup: [`deployment-evidence/2026-11-20-production-backup-recovery-evidence.json`](deployment-evidence/2026-11-20-production-backup-recovery-evidence.json)  
- Step 4 failure: [`deployment-evidence/2026-11-20-production-migrate-step4-result.json`](deployment-evidence/2026-11-20-production-migrate-step4-result.json)  
- Rehearsal: [`RELEASE-001-STEP4A-REHEARSAL-RESULT.md`](RELEASE-001-STEP4A-REHEARSAL-RESULT.md)