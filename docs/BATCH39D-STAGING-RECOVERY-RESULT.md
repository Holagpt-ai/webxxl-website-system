# BATCH39D — Staging CRM recovery attempt (stopped @ Prisma P3012)

**Date:** 2026-11-02 · **`main`:** `8082ae164600a2af0fe5bdc1fb64dc8cb202f468` (PR #93 merged)  
**Staging:** `vcgibefnhneaqhcguhnt` · **Production:** not accessed

## Preconditions (read-only) — PASS

| Check | Result |
|---|---|
| Staging identity preflight | `supabase:vcgibefnhneaqhcguhnt/postgres` |
| Finished migration rows | **20** (distinct successful applies) |
| `crm05_foundation` | **finished** |
| `crm05a_integrity` | **failed_or_pending** (before step 9) |
| Public `Crm*` tables / enums | **none** |
| `CustomerAccount` / `User` rows | **0** |
| Foundation SQL on `main` | **347** lines, **no BOM**, executable `CREATE TABLE "CrmImportJob"` |

## Authorized recovery executed

| Step | Command | Result |
|---|---|---|
| 9 | `migrate resolve --rolled-back 20261018200000_crm05a_integrity` | **SUCCESS** |
| 10 | `migrate resolve --rolled-back 20261018190000_crm05_foundation` | **BLOCKED — P3012** (“cannot be rolled back because it is not in a failed state”) |
| 11–13 | `migrate deploy` | **NOT RUN** (stopped per runbook) |

No manual `_prisma_migrations` edits. No reset / `db push`.

## Post-step-9 state

- `crm05a_integrity` marked **rolled back** (eligible for re-apply on next deploy).
- `crm05_foundation` remains **finished** in history while staging still has **zero CRM DDL**.
- `migrate status` shows **19** later folders not yet applied; **`crm05_foundation` still considered applied**.

## Blocker

Prisma **does not** allow `--rolled-back` on a **successful** migration (`P3012`). The BATCH39C two-step resolve procedure cannot complete without an **owner-approved** alternate (e.g. new forward repair migration, or Prisma-documented baseline for edited historical migrations). **Do not** hand-edit migration history without separate authorization.

## Next owner decision (not executed)

Choose one path with explicit authorization:

1. **Forward repair migration** (new timestamp) containing CRM foundation DDL `IF NOT EXISTS` + reconcile history, or  
2. **Prisma baseline / migration squashing** policy for staging-only with owner sign-off, or  
3. **Staging database replace** (new Supabase project) — full chain from empty (separate infra approval).

Until then, staging remains **partial** (~20/39 effective schema; CRM layer missing).
