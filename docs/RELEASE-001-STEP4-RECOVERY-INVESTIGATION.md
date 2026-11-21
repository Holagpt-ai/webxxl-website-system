# RELEASE-001 Step 4 — Failed migration recovery investigation (read-only)

**Recorded:** 2026-11-20  
**GitHub `main`:** `570b223f22b855f703c48d5da5504d92a5c5125f`  
**Production Supabase:** `txfxeehglqfszletuumn`  
**Authorization:** Investigation only — no `migrate deploy`, `migrate resolve`, SQL, ledger edits, restore, staging, or deploy.

**Related evidence:** [`deployment-evidence/2026-11-20-production-migrate-step4-result.json`](deployment-evidence/2026-11-20-production-migrate-step4-result.json), [`deployment-evidence/2026-11-20-production-backup-recovery-evidence.json`](deployment-evidence/2026-11-20-production-backup-recovery-evidence.json)

---

## Executive diagnosis

| Item | Finding |
|------|---------|
| Failure | **P3018** / PostgreSQL **42710** on first statement of `20261014190000_batch24_change_requests`: `type "ChangeRequestCategory" already exists` |
| Ledger | **11** finished; **1** failed/unresolved (`batch24`); **0** rolled back |
| Schema vs ledger | **Schema/ledger drift** — Batch **24** (and likely **25**, **26**, **28.3**) DDL is **already present** in `public`, but the Prisma migration history does not record them as finished |
| Batch 24 apply state | **Previously fully applied (out-of-band or prior attempt)** — not a partial apply from the 2026-11-20 deploy run (`applied_steps_count` = 0; failure on line 1) |
| Live tenant data | Preserved — read-only counts: `CustomerAccount` 2, `User` 4, `ChangeRequest` 1, `Project` 4 |

---

## Failed migration record (`20261014190000_batch24_change_requests`)

| Field | Value |
|-------|-------|
| `started_at` | `2026-11-20T19:17:29.835Z` |
| `finished_at` | `null` |
| `rolled_back_at` | `null` |
| `applied_steps_count` | `0` |
| Error (redacted) | Prisma: migration failed to apply; Postgres **42710** — `ERROR: type "ChangeRequestCategory" already exists` |

Full `logs` payload retained in production `_prisma_migrations` (~1235 chars); not copied here (no secrets; standard Prisma failure text).

---

## Batch 24 SQL vs production schema (operation-by-operation)

Source: [`prisma/migrations/20261014190000_batch24_change_requests/migration.sql`](../prisma/migrations/20261014190000_batch24_change_requests/migration.sql)

| # | Migration operation | Production `public` |
|---|---------------------|---------------------|
| 1 | `CREATE TYPE "ChangeRequestCategory"` (5 labels) | **Present** — DESIGN, CONTENT, MEDIA, FUNCTIONALITY, OTHER |
| 2 | `ALTER TYPE "ProjectActivityEventType" ADD VALUE 'CHANGE_REQUEST_UPDATED'` | **Present** |
| 3 | `ChangeRequest.category` NOT NULL DEFAULT `'OTHER'` | **Present** — `ChangeRequestCategory`, NOT NULL, default `'OTHER'` |
| 4 | `ChangeRequest.websitePreviewVersionId` TEXT | **Present** — nullable |
| 5 | `ProjectComment.changeRequestId` TEXT | **Present** — nullable |
| 6 | Index `ChangeRequest_websitePreviewVersionId_idx` | **Present** |
| 7 | Index `ProjectComment_changeRequestId_idx` | **Present** |
| 8 | FK `ChangeRequest_websitePreviewVersionId_fkey` → `WebsitePreviewVersion` | **Present** |
| 9 | FK `ProjectComment_changeRequestId_fkey` → `ChangeRequest` | **Present** |

**Conclusion:** Batch 24 matches migration file; deploy failed only because operation 1 is not idempotent and the type already existed.

---

## Bounded scan: remaining pending migrations (28) vs production

Last ledger-successful migration: `20261013170000_website_preview`. Repo defines **29** folders after that (40 total in chain).

Heuristic scan: first `CREATE TYPE` / `CREATE TABLE` in each script vs live `public` (read-only, 2026-11-20).

| Migration folder | Primary risk | Production signal |
|------------------|--------------|-------------------|
| `20261014190000_batch24_change_requests` | **BLOCKER** — unresolved failed row | All objects **exist** — **deploy will fail** on `CREATE TYPE` |
| `20261014193000_batch25_dependency_actions` | ALTER-only | Columns `customerActionKey`, `allowsCustomerAck` **exist** — **would fail** on `ADD COLUMN` if reached |
| `20261014194500_batch26_project_template_snapshot` | ALTER (`IF NOT EXISTS`) | `templateId`, `templateVersion` **exist** — low conflict if run (idempotent SQL) but **ledger gap** |
| `20261014203000_batch28_3_owner_review` | **HIGH** — types + table | Types + `ProjectOwnerReviewDecision` **exist** — **would fail** on `CREATE TYPE` / `CREATE TABLE` |
| `20261017220000_found01_platform_identity` | 9 enums, 12 tables | **Not detected** — likely first **real** deploy target after reconciliation |
| `20261018130000_agent03_internal_workforce` | 4 types, 9 tables | Not detected |
| `20261018170000_social04_marketing_studio` | 8 types, 11 tables | Not detected |
| `20261018180000_social04a_integrity` | ALTER-only | No CREATE conflict surfaced |
| `20261018190000_crm05_foundation` | 13 types, 26 tables | Not detected |
| `20261018200000_crm05a_integrity` | 1 table | Not detected |
| `20261018210000_comms06_foundation` | 7 types, 15 tables | Not detected |
| `20261018220000_comms06a_integrity` | ALTER-only | No CREATE conflict surfaced |
| `20261018230000_seo07_foundation` | 6 types, 15 tables | Not detected |
| `20261018240000_mkt08_foundation` | 4 types, 8 tables | Not detected |
| `20261018250000_wallet09_foundation` | 1 type, 5 tables | Not detected |
| `20261018260000_wallet09b_integrity` | ALTER-only | No CREATE conflict surfaced |
| `20261018270000_wallet09c_ledger_actor_service` | ALTER-only | No CREATE conflict surfaced |
| `20261018280000_auto10_workflow_foundation` | 3 types, 6 tables | Not detected |
| `20261018290000_auto10c_outbox_dispatch_lease` | ALTER-only | No CREATE conflict surfaced |
| `20261020120000_commerce11_foundation` | 10 types, 14 tables | Not detected |
| `20261020140000_ai_customer_13_foundation` | 7 types, 11 tables | Not detected |
| `20261021120000_analytics14_foundation` | 1 type, 3 tables | Not detected |
| `20261025120000_analytics15_ingestion` | 1 table | Not detected |
| `20261025180000_analytics151_rate_limit` | 1 table | Not detected |
| `20261031120000_batch28a_managed_site_leads` | 1 type, 3 tables | Not detected |
| `20261031120000_mkt25_crm_audience_planning` | ALTER-only | No CREATE conflict surfaced |
| `20261031140000_batch28a_2_intake_payload_fingerprint` | ALTER-only | No CREATE conflict surfaced |
| `20261102130000_batch37_customer_ai_pilot_persistence` | 3 types, 2 tables | Not detected |
| `20261114143000_batch9d_support_request_messages` | 1 table (`SupportRequestMessage`) | **Not present** — expected gap vs staging **40/40** |

**Obvious conflicts before retry:** at least **4** ledger folders (**24**, **25**, **28.3**, plus failed ledger state on **24**) where live schema already reflects migration SQL. **Blind `migrate deploy` is NO-GO.**

**Caveat:** ALTER-only migrations (**25**, **26**, integrity batches) need per-column/default/FK verification before any `migrate resolve --applied`; this investigation verified presence of expected columns for **25**/**26** only, not every constraint.

**Historical note:** Staging baseline doc [`BATCH39F-STAGING-BASELINE-SNAPSHOT.md`](BATCH39F-STAGING-BASELINE-SNAPSHOT.md) recorded `batch24_change_requests` as finished on staging — supports “schema ahead of production ledger” hypothesis, not production ledger proof.

---

## Data preservation

No investigation SQL modified data. Tenant boundaries (`CustomerAccount`, memberships, billing links), approvals, and project history tables were not altered. Recovery must **not** drop or truncate customer-facing tables; prefer ledger reconciliation over schema rollback.

---

## Recommended repair sequence (NOT EXECUTED — owner / DBA gate)

Prisma-supported path when **database already matches** migration SQL but **ledger is wrong**:

1. **New encrypted backup** of current production (ledger **11 + 1 unresolved**, schema ahead). Pre-migrate Step 2 backup (`…994Z.dump.gpg`, SHA-256 `1cf20467f7fbed1efbfdda0eb626e1c388f6634fbfb8604d6e18f8bd7fd659e8`) remains valid rollback to **11/40 ledger** and **pre–Batch-24 schema** — **not** to current mixed state without restore + data loss risk for post–Batch-24 writes (minimal today: 1 `ChangeRequest` may use `category`).

2. **Rehearsal (required):** Restore a **fresh** production dump into isolated PostgreSQL 17 (same method as Step 2 recovery test). Replay the **exact** `migrate resolve` sequence below; confirm `migrate deploy` reaches **40/40** without SQL errors. Do not rehearse on production first.

3. **Clear failed migration** (production, only after rehearsal sign-off — see [`RELEASE-001-STEP4A-REHEARSAL-RESULT.md`](RELEASE-001-STEP4A-REHEARSAL-RESULT.md)):
   - **Rehearsal PASS:** `npx prisma migrate resolve --applied "20261014190000_batch24_change_requests"` **without** a prior `--rolled-back` (Prisma leaves one rolled-back history row + one finished row).

4. **Mark schema-aligned migrations applied** (one command per folder, with evidence checklist mirroring tables above):
   - `… --applied "20261014193000_batch25_dependency_actions"` (verify defaults/constraints)
   - `… --applied "20261014194500_batch26_project_template_snapshot"`
   - `… --applied "20261014203000_batch28_3_owner_review"` (verify indexes/FKs match file)

5. **`npx prisma migrate deploy`** — expect first **executed** SQL migration at **`20261017220000_found01_platform_identity`** through **`20261114143000_batch9d_support_request_messages`**.

6. **Post-verify:** `_prisma_migrations` **40** finished, **0** unresolved; spot-check `SupportRequestMessage` exists; application smoke on pooler connection.

**Do not:** manual `_prisma_migrations` DELETE/UPDATE, `prisma db execute` to “fix” enums, or restore Step 2 backup onto production without explicit RTO authorization.

---

## Isolated PostgreSQL rehearsal

| Question | Answer |
|----------|--------|
| Necessary before production repair? | **YES** — multiple `resolve --applied` steps + long deploy tail; wrong resolve is hard to unwind |
| Stocksist / staging | **Out of scope** — use ephemeral Docker PG 17 only |

---

## Backup and recovery evidence

| Artifact | Status |
|----------|--------|
| Encrypted pre-migrate dump | **Present** on disk (`Test-Path` true 2026-11-20) — path/SHA in [`2026-11-20-production-backup-recovery-evidence.json`](deployment-evidence/2026-11-20-production-backup-recovery-evidence.json) |
| Isolated restore test (11/40) | **PASS** documented in same file |
| Post–Step-4 backup | **NOT CAPTURED** — take before any recovery authorization |

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| `resolve --applied` on migration whose schema **differs** from SQL file | High | Line-by-line checklist per folder; rehearsal |
| Blind `migrate deploy` retry | High | **Do not** — known 42710 on **24** and **28.3** |
| Restoring Step 2 backup to “fix” ledger | Medium | Loses schema objects already in use; only with RTO plan |
| Long deploy from **found01→9d** on live DB | Medium | Off-hours; pooler session; monitor locks |
| Application/runtime mismatch | Low–medium | Vercel SHA may assume columns from **found01+** not yet in DB until deploy completes |

---

## GO / NO-GO (recovery operation — separate authorization)

| Action | Verdict |
|--------|---------|
| Immediate **`migrate deploy` retry** | **NO-GO** |
| **`migrate resolve` + reconcile 24–28.3 + deploy remainder** with rehearsal + new backup + runbook | **GO** (conditional — owner/DBA authorization only) |
| This investigation | **COMPLETE** — read-only; no repair executed |

---

## Next owner gate

1. Approve recovery runbook and rehearsal window.  
2. Capture **post-failure** encrypted backup.  
3. Execute rehearsal resolve chain on isolated DB.  
4. Production resolve + deploy under monitored change window.  
5. Update `DEPLOYMENT_STATUS`, `PROJECT_MEMORY`, `SESSION_HANDOFF` after verified **40/40**.