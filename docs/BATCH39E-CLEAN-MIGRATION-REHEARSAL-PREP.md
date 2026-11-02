# BATCH39E — Clean migration rehearsal preparation (repo + doc only)

**Date:** 2026-11-02 · **Baseline `main`:** `3c7f16497d6ba017a62c6b94dafb917fb4f72f1a` (includes PR #93 @ `8082ae1`, PR #94 legal)  
**Scope:** Read-only SQL inventory, regression guards, clean-rehearsal recommendation. **No** database writes, **no** new Supabase project, **no** `migrate deploy`.

## SQL scan summary

| Check | Migrations scanned | Defects |
|---|---:|---:|
| UTF-8 BOM | 39 | **0** |
| Single-line swallowed SQL (entire file one comment) | 39 | **0** |
| Inline `-- Create*` + `CREATE` on same physical line | 39 | **0** |
| Static `ALTER TABLE` before prior `CREATE TABLE` (cross-file) | 39 | **0** |
| Missing `migration.sql` | 39 | **0** |

**Advisory (non-blocking):** two folders share timestamp prefix `20261031120000` (`batch28a_managed_site_leads`, `mkt25_crm_audience_planning`); Prisma applies by full folder name sort — order is deterministic.

**CRM foundation (`20261018190000_crm05_foundation`):** multi-line enums, `CREATE TABLE "CrmImportJob"`, no BOM — executable DDL on current `main`.

## Validation run (no DB)

| Command | Result |
|---|---|
| `npx tsx scripts/release-readiness.ts --verify-ordering` | **PASS** (39 folders; duplicate-prefix advisory only) |
| `npx vitest run __tests__/platform/batch39a-migration-bom-guard.test.ts` | **PASS** |
| `npx vitest run __tests__/platform/batch38-release-readiness.test.ts` | **PASS** |
| `npx tsx scripts/migration-rehearsal.ts --check-files` | **PASS** (39/39 in dependency matrix) |

## Regression guards (this batch)

`validateMigrationOrderingSafeguards()` now blocks:

- `UTF8_BOM_IN_SQL` (Batch 39A)
- `SINGLE_LINE_MIGRATION_SQL` (Batch 39C)
- **`INLINE_PRISMA_COMMENT_DDL`** (Batch 39E) — any line matching `-- CreateEnum CREATE …` etc.

Wired via `pnpm release:readiness --verify-ordering` and CI application validate workflow.

## Existing staging (`vcgibefnhneaqhcguhnt`) — preserve evidence

| Fact | Implication |
|---|---|
| ~20/39 migrations applied; CRM layer **absent** | `crm05_foundation` marked finished after no-op SQL (pre–#93) |
| P3012 on `resolve --rolled-back` for finished foundation | Cannot replay corrected foundation on **this** history without workaround |
| `crm05a_integrity` rolled back (39D) | Next deploy would retry integrity **after** foundation gap unless history fixed elsewhere |
| Zero customer rows | Safe to **keep** as forensic record; do **not** reset for rehearsal prep |

**Do not** use the same `public` schema on this project for a “clean” full-chain deploy without either reset (forbidden without separate authorization) or a forward-repair migration (39D blocker).

## Can this Supabase project host a separate clean target?

| Option | Affects current staging? | Prisma fit | Verdict |
|---|---|---|---|
| **New Supabase project** (empty Postgres) | **No** — separate ref + env | Standard `migrate deploy` on empty DB | **Recommended** |
| **Local Docker Postgres** (dev container) | **No** | Same; bind `DATABASE_URL` locally | **Recommended** for engineer-only rehearsal |
| **Second PostgreSQL database** (`CREATE DATABASE …`) on same instance | **Low** if separate connection string; shared instance ops | Requires non-default DB name in URL; pooler/docs less common on Supabase | **Possible** but owner must confirm Supabase support + pooler URL |
| **Alternate schema** (e.g. `rehearsal`) | Risky — shared `public` partial state | Prisma datasource is `public`-centric today | **Not supported** without schema migration policy change |
| **Reset current staging DB** | **Destroys** failure evidence | Would allow clean deploy | **Out of scope** for 39E; separate owner authorization |

## Recommended clean-rehearsal environment (simplest supported)

1. **Primary:** provision a **new isolated Supabase project** (staging tier), document ref in `STAGING-SUPABASE-BINDING.md` as **rehearsal** (distinct from `vcgibefnhneaqhcguhnt`), host-only env file — **not provisioned in 39E**.
2. **Secondary:** **Docker Postgres 16** on developer machine for repeatability; no cloud cost; same 39-folder `migrate deploy` proof.

Keep **`vcgibefnhneaqhcguhnt`** unchanged as the partial-apply / P3012 evidence database until owner archives or replaces it explicitly.

## Migration readiness estimate

| Layer | Readiness |
|---|---|
| Repository SQL (39 files) | **High** — scan clean; guards in CI |
| Clean empty DB full-chain deploy | **High** — expected to apply all 39 once target is empty |
| Current staging project completion | **Blocked** — P3012 / no-op foundation history (see [`BATCH39D-STAGING-RECOVERY-RESULT.md`](BATCH39D-STAGING-RECOVERY-RESULT.md)) |
| Production | **UNVERIFIED** — no access in this batch |

## Owner authorization needed (next batch — not executed here)

1. **Create** new Supabase rehearsal project **or** approve local Docker target (name ref, collision guard env, `WEBXXL_STAGING_BOUNDARIES_CONFIRMED=1`).
2. **Authorize** staging-only `pnpm exec prisma migrate deploy` against the **new** target only (not production `txfxeehglqfszletuumn`).
3. **Optional:** snapshot policy for `vcgibefnhneaqhcguhnt` before any future repair on that project.
4. **Explicitly decline** reset / manual `_prisma_migrations` edits unless a separate runbook is approved.

## Related

- [`BATCH39C-STAGING-CRM-MIGRATION-RECOVERY.md`](BATCH39C-STAGING-CRM-MIGRATION-RECOVERY.md)
- [`BATCH39D-STAGING-RECOVERY-RESULT.md`](BATCH39D-STAGING-RECOVERY-RESULT.md)
- [`STAGING-SUPABASE-BINDING.md`](STAGING-SUPABASE-BINDING.md)
