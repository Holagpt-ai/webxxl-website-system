# RELEASE-001 Step 3 — Production migration readiness (plan only)

**Recorded:** 2026-11-20 · **GitHub `main`:** `570b223f22b855f703c48d5da5504d92a5c5125f` · **Production Supabase:** `txfxeehglqfszletuumn`

**Step 2:** COMPLETE — see [`deployment-evidence/2026-11-20-production-backup-recovery-evidence.json`](deployment-evidence/2026-11-20-production-backup-recovery-evidence.json). **Step 4 (migrate deploy): ATTEMPTED 2026-11-20 — FAILED (see [`deployment-evidence/2026-11-20-production-migrate-step4-result.json`](deployment-evidence/2026-11-20-production-migrate-step4-result.json)).** **Step 4 recovery investigation (read-only):** [`RELEASE-001-STEP4-RECOVERY-INVESTIGATION.md`](RELEASE-001-STEP4-RECOVERY-INVESTIGATION.md). **Step 4A isolated rehearsal:** **PASS** — [`RELEASE-001-STEP4A-REHEARSAL-RESULT.md`](RELEASE-001-STEP4A-REHEARSAL-RESULT.md). **Step 4B post-failure backup:** **PASS** — [`RELEASE-001-STEP4B-POST-FAILURE-BACKUP.md`](RELEASE-001-STEP4B-POST-FAILURE-BACKUP.md). **Step 4C production repair:** **PASS** — [`RELEASE-001-STEP4C-PRODUCTION-REPAIR.md`](RELEASE-001-STEP4C-PRODUCTION-REPAIR.md).

### Step 4 outcome (2026-11-20)

| Item | Value |
|---|---|
| Result | **FAIL** — `P3018` on `20261014190000_batch24_change_requests` |
| Postgres | `42710` — `ChangeRequestCategory` already exists |
| Post ledger | **11** finished, **1** unresolved (`batch24_change_requests`) |
| Drift | `public` contains objects from pending migrations while ledger still at 11 |

No `migrate resolve`, manual SQL, or restore performed in this run.

## Pending migration chain

| Fact | Value |
|---|---|
| Repository migration folders | **40** (ordering safeguards PASS @ `570b223`) |
| Production applied (verified 2026-11-20) | **11** |
| Pending | **29** |
| First pending | `20261014190000_batch24_change_requests` |
| Last pending | `20261114143000_batch9d_support_request_messages` |
| Staging (`vcgibefnhneaqhcguhnt`) | **40/40** (includes Batch 9D); rehearsal reference only |

Duplicate timestamp advisory: `20261031120000_batch28a_managed_site_leads` before `20261031120000_mkt25_crm_audience_planning` (lexicographic order).

## Schema scope vs backup

- Pending migrations are **Prisma `public` schema** DDL/DML (enums, tables, constraints). No pending migration requires restoring or writing **Supabase-managed** schemas (`auth`, `extensions`, `realtime`, `vault`, `graphql`).
- **Already applied** on production: `20261011200000_restrict_supabase_api_access` (conditional REVOKE for `anon` / `authenticated` on `public`).
- Recovery test confirmed: vanilla Postgres restore **omits** Supabase platform schemas; **public** ledger and app tables restored correctly for **11/40** baseline.
- **Limitation:** Platform PITR/dashboard restore remains separate from this logical backup; backup is sufficient for **public** rollback before migrate apply.

## Operator connection (IPv4)

| Use | Method |
|---|---|
| Direct `db.txfx….supabase.co` | **Unavailable** from owner Windows path (IPv6-only AAAA; TCP 5432 fails) — do not use for operator CLI |
| **Migrate deploy / backup** | **Session pooler** URI, port **5432**, user `postgres.txfxeehglqfszletuumn` — verified for read + `pg_dump` (local `BACKUP_DATABASE_URL` pattern only; no Vercel/env changes in Step 3) |
| Identity preflight | `WEBXXL_PRODUCTION_DATABASE_IDENTITY=supabase:txfxeehglqfszletuumn/postgres`; refuse `vcgibefnhneaqhcguhnt` |

Prisma: set **`DATABASE_URL` and `DIRECT_URL`** to the **same session-pooler URI** for the migrate run if direct is unreachable (Supabase-supported for session mode). Do not alter Vercel Production env in the same window unless separately authorized.

## Step 2 evidence sufficiency

| Requirement | Status |
|---|---|
| Pre-migrate encrypted backup | **PASS** (SHA-256 recorded in JSON evidence) |
| Restore drill (`public` + ledger) | **PASS** (11 finished, 0 unresolved) |
| GPG passphrase | **Owner responsibility** — store outside backup directory (Credential Manager / password manager); do not delete/move artifacts without authorization |

## Execution plan (Step 4 — owner authorization required)

1. **Window:** brief app errors possible until DB matches code (`main` expects 40-folder schema).
2. **Preflight:** file-only parse → `txfx…` only; `prisma migrate status` → **29** pending, latest applied `20261013170000_website_preview`.
3. **Apply:** `pnpm exec prisma migrate deploy` with pooler URLs (no partial SQL, no `_prisma_migrations` edits).
4. **Post:** read-only ledger **40/40**, zero unresolved; record UTC, operator, SHA `570b223`.
5. **Flags/providers:** **Gate C** — separate; migrations do not activate CRM/Resend/etc.

### Failure recovery

| Failure | Action |
|---|---|
| Mid-deploy error | Stop; no manual ledger edits. Assess last successful migration name. |
| Broken post-migrate | **Vercel** rollback does not rollback DB — restore **public** from `.dump.gpg` to **new** isolated Postgres or Supabase PITR if enabled; production forward-fix only with owner DBA plan. |
| Rollback data | Encrypted backup is **pre-29-migration** state (11/40). |

## Recommendation

| | |
|---|---|
| **Step 3 readiness (plan + backup)** | **GO** — chain defined, staging 40/40 rehearsal, production 11/40 verified, backup + restore demonstrated |
| **Execute production `migrate deploy` now** | **NO-GO** — requires **explicit owner authorization for RELEASE-001 Step 4** (not granted) |
| **Remaining blockers before production cutover beyond migrate** | **AUTH-STAGING-8C**, **POLICY-SUB-001**, Vercel auth/email proof, post-migrate smoke |