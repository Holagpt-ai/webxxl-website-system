# RELEASE-001 Step 4A — Isolated recovery rehearsal result

**Recorded:** 2026-11-20  
**GitHub `main`:** `570b223f22b855f703c48d5da5504d92a5c5125f`  
**Environment:** Ephemeral Docker **PostgreSQL 17** (`webxxl-rehearsal-4a-2026-11-20-*`) — **not** production, staging, or Stocksist  
**Machine evidence:** [`deployment-evidence/2026-11-20-production-migrate-step4a-rehearsal.json`](deployment-evidence/2026-11-20-production-migrate-step4a-rehearsal.json)

## Verdict: **PASS**

| Check | Result |
|-------|--------|
| Restore pre-migrate encrypted backup | **11** finished, **0** unresolved; row counts **2 / 4 / 1 / 4** |
| Reproduce P3018 failure (drift + `migrate deploy`) | **PASS** — **42710** on `ChangeRequestCategory` |
| Schema verification Batches **24, 25, 26, 28.3** | **All checks true** (enums, defaults, indexes, FKs, `ProjectOwnerReviewDecision`) |
| Batch 24 resolve on failed record | **`migrate resolve --applied` alone** — **PASS** (no `--rolled-back` step required) |
| Mark **25 / 26 / 28.3** applied (clone only) | **PASS** — ledger **15** finished before deploy |
| `migrate deploy` remainder (**found01 → 9d**) | **PASS** — **25** migrations applied |
| Final ledger | **40** finished, **0** unresolved, **1** historical rolled-back row (failed attempt) |
| `SupportRequestMessage` | **Present** |
| Customer/project row preservation | **Unchanged** after full chain |
| Stocksist containers | **Unchanged** (`stocksist_unchanged: true`) |

## Batch 24 ledger behavior (rehearsal)

After failed deploy + `resolve --applied`, `_prisma_migrations` holds **two** rows for `20261014190000_batch24_change_requests`:

1. Failed attempt — `rolled_back_at` set, `finished_at` null  
2. Applied record — `finished_at` set, `rolled_back_at` null  

This is expected Prisma behavior; **do not** manually delete the rolled-back row.

## Controlled production repair proposal (NOT EXECUTED)

**Prerequisites:** fresh encrypted backup of **current** production — **COMPLETE** (Step 4B, [`RELEASE-001-STEP4B-POST-FAILURE-BACKUP.md`](RELEASE-001-STEP4B-POST-FAILURE-BACKUP.md)); explicit owner authorization for **live** repair; pooler IPv4 session.

Set both `DATABASE_URL` and `DIRECT_URL` to the authorized production pooler URI (same as Step 4).

```powershell
# 1) Clear failed Batch 24 — direct --applied sufficient per rehearsal
npx prisma migrate resolve --applied "20261014190000_batch24_change_requests"

# 2) Mark drift-aligned migrations (verify production schema matches investigation first)
npx prisma migrate resolve --applied "20261014193000_batch25_dependency_actions"
npx prisma migrate resolve --applied "20261014194500_batch26_project_template_snapshot"
npx prisma migrate resolve --applied "20261014203000_batch28_3_owner_review"

# 3) Apply remaining chain
npx prisma migrate deploy
```

**Expected:** First **executed** SQL at `20261017220000_found01_platform_identity`; final state **40/40** finished, **0** unresolved.

**Do not** retry blind `migrate deploy` without steps 1–2.

## Supabase vs vanilla rehearsal limitations

| Topic | Rehearsal | Production |
|-------|-----------|------------|
| Host | Local Docker PG 17, `trust` auth | Supabase session pooler, SCRAM |
| Restore source | Pre-migrate `pg_dump -Fc` (public-focused) | Live DB; no restore in repair path |
| Roles / extensions | No `auth`, `realtime`, `vault`, `supabase_*` roles | Full Supabase role graph |
| `REVOKE`/`GRANT` in later migrations | Applied cleanly in vanilla PG | May warn or require role existence (monitor logs) |
| IPv6 direct host | N/A | **Unreachable** from owner Windows — use pooler only |

Rehearsal validates **Prisma ledger + SQL chain** logic; it does **not** certify every Supabase-specific privilege statement without a Supabase-target rehearsal or staging mirror.

## GO / NO-GO

| Action | Verdict |
|--------|---------|
| Production repair (resolve + deploy) | **NO-GO** until **separate owner authorization** (Step 4B backup **PASS**) |
| Repair runbook confidence | **GO** — isolated rehearsal **PASS** |

## Related

- Read-only investigation: [`RELEASE-001-STEP4-RECOVERY-INVESTIGATION.md`](RELEASE-001-STEP4-RECOVERY-INVESTIGATION.md)  
- Step 4 failure: [`deployment-evidence/2026-11-20-production-migrate-step4-result.json`](deployment-evidence/2026-11-20-production-migrate-step4-result.json)  
- Pre-migrate backup: [`deployment-evidence/2026-11-20-production-backup-recovery-evidence.json`](deployment-evidence/2026-11-20-production-backup-recovery-evidence.json)