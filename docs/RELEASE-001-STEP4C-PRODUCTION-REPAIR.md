# RELEASE-001 Step 4C — Controlled production migration repair

**Recorded:** 2026-11-20  
**Production:** `txfxeehglqfszletuumn`  
**GitHub `main` (migration source):** `570b223f22b855f703c48d5da5504d92a5c5125f`  
**Machine evidence:** [`deployment-evidence/2026-11-20-production-migrate-step4c-result.json`](deployment-evidence/2026-11-20-production-migrate-step4c-result.json)

## Verdict: **PASS**

| Check | Result |
|-------|--------|
| Step 4B backup SHA-256 on disk | **PASS** (`44aed9eb…d58fd`) |
| Preflight ledger | **11** finished, **1** unresolved (`batch24`) |
| Schema Batches **24 / 25 / 26 / 28.3** | **All true** (enums, columns, indexes, FKs) |
| `migrate resolve --applied` (×4) | **All exit 0** |
| Post-resolve ledger | **15** finished, **0** unresolved, **1** rolled-back history row |
| `migrate deploy` | **Exit 0** — **25** migrations applied (`found01` → `batch9d`) |
| Final ledger | **40** finished, **0** unresolved, **1** rolled-back (failed attempt history) |
| `SupportRequestMessage` | **Present** |
| Row preservation | `CustomerAccount` **2**, `User` **4**, `ChangeRequest` **1**, `Project` **4** (unchanged) |

## Commands executed (production)

Connection: session pooler via `BACKUP_DATABASE_URL` (`DATABASE_URL` + `DIRECT_URL` set identically for CLI).

| UTC (approx.) | Command |
|---------------|---------|
| 2026-11-20T20:05:46Z | `npx prisma migrate resolve --applied "20261014190000_batch24_change_requests"` |
| 2026-11-20T20:06:19Z | `npx prisma migrate resolve --applied "20261014193000_batch25_dependency_actions"` |
| 2026-11-20T20:06:31Z | `npx prisma migrate resolve --applied "20261014194500_batch26_project_template_snapshot"` |
| 2026-11-20T20:06:39Z | `npx prisma migrate resolve --applied "20261014203000_batch28_3_owner_review"` |
| 2026-11-20T20:06:50Z | `npx prisma migrate deploy` |

**Not executed:** restore, manual SQL, staging, Stocksist, Vercel deploy, flags, DNS, publishing.

## Production migration state (post–Step 4C)

| Metric | Value |
|--------|--------|
| Repo migration folders | **40** |
| `_prisma_migrations` finished (non–rolled-back) | **40** |
| Unresolved | **0** |
| Rolled-back rows (historical) | **1** (Batch 24 failed attempt — retain) |
| Staging `vcgib…` | **Untouched** |

**MIGRATED** on production for repo chain @ `570b223…` — subject to app/runtime verification separately (not in Step 4C).

## Related

- Step 4 failure: [`deployment-evidence/2026-11-20-production-migrate-step4-result.json`](deployment-evidence/2026-11-20-production-migrate-step4-result.json)  
- Step 4A rehearsal: [`RELEASE-001-STEP4A-REHEARSAL-RESULT.md`](RELEASE-001-STEP4A-REHEARSAL-RESULT.md)  
- Step 4B backup: [`RELEASE-001-STEP4B-POST-FAILURE-BACKUP.md`](RELEASE-001-STEP4B-POST-FAILURE-BACKUP.md)