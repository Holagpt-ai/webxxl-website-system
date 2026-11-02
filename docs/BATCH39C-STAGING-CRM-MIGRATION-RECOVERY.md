# BATCH39C — CRM migration dependency investigation and staging recovery (doc only)

**Status:** MERGED (PR #93 @ `8082ae164600a2af0fe5bdc1fb64dc8cb202f468`) · **Baseline `main`:** `8082ae1`+  
**Scope:** Root-cause analysis, repository SQL repair, CI guard, **documented** staging recovery. **No** DB writes in this batch.

## Root cause

`prisma/migrations/20261018190000_crm05_foundation/migration.sql` was stored as **one physical line** (~entire CRM DDL concatenated). Each segment began with Prisma-style `-- CreateEnum CREATE TYPE …` on the **same line** as DDL.

PostgreSQL `--` comments run to **end of line**. With no newlines, **the entire file is one comment** — zero enums/tables/indexes/FKs execute. Prisma still recorded the migration **finished** (empty script succeeds).

`20261018200000_crm05a_integrity` then runs:

```sql
ALTER TABLE "CrmImportJob" ADD COLUMN "committedContactCount" INTEGER;
```

Postgres **42P01**: relation `"CrmImportJob"` does not exist.

**Not** identifier quoting mismatch, wrong schema, or missing forward migration in repo — **missing DDL** from no-op foundation apply.

## Where `CrmImportJob` is created

In **`20261018190000_crm05_foundation`** (after repair), `CREATE TABLE "CrmImportJob" (…)` — matches `prisma/schema.prisma` model `CrmImportJob`.

## Staging read-only inventory (`vcgibefnhneaqhcguhnt`, 2026-11-02)

| Item | State |
|---|---|
| `_prisma_migrations` finished | **20** (includes `crm05_foundation`) |
| Failed / pending | **`20261018200000_crm05a_integrity`** |
| `20251008120000_customer_portal_core` | **Two rows** (historical `rolled_back` + successful re-apply `finished`) |
| Public `Crm*` tables | **None** |
| `CrmImportJob` | **Does not exist** |
| `CustomerAccount` / `User` rows | **0** |

Portal/platform objects from migrations 1–19 **are** present; CRM layer absent.

## Repository fix (Batch 39C PR)

- Reformat `crm05_foundation/migration.sql` to **multi-line** statements (`-- CreateEnum` on its own line, then `CREATE TYPE`, etc.).
- Add blocking safeguard **`SINGLE_LINE_MIGRATION_SQL`** in `migration-ordering-safeguards.ts` (CI via `release:readiness --verify-ordering`).

**Note:** Editing a migration already marked applied is justified here because staging applied **no CRM DDL**. Production CRM migration status remains **UNVERIFIED** — owner must confirm before production deploy.

## Staging-only recovery (owner — **not executed** in 39C)

**Do not** use `migrate reset` or `db push`. **Do not** touch production.

1. Merge Batch **39C** PR (fixed foundation SQL + guard).
2. Load `.env.staging.local`; confirm `supabase:vcgibefnhneaqhcguhnt/postgres`.
3. Optional Supabase backup.
4. Clear failed integrity migration:

   ```bash
   pnpm exec prisma migrate resolve --rolled-back 20261018200000_crm05a_integrity
   ```

5. Mark no-op foundation as rolled back so deploy can re-apply **fixed** SQL:

   ```bash
   pnpm exec prisma migrate resolve --rolled-back 20261018190000_crm05_foundation
   ```

   **Batch 39D evidence:** Prisma **P3012** rejects this when the row is **finished** (not failed). If step 5 fails, **stop** — see [`BATCH39D-STAGING-RECOVERY-RESULT.md`](BATCH39D-STAGING-RECOVERY-RESULT.md).

6. Deploy remainder of chain:

   ```bash
   pnpm exec prisma migrate deploy
   ```

   Expect: re-apply foundation (creates all CRM tables including `CrmImportJob`), then `crm05a_integrity`, then **18** pending migrations.

7. Verify: `_prisma_migrations` count, `CrmImportJob` exists, `PILOT_READINESS_DB_PROBE=1 pnpm release:readiness`.

**Do not** manually run ad-hoc SQL except if read-only inventory diverges (portal tables missing, partial CRM, customer rows) — then stop for owner SQL review.

## Alternatives considered

| Approach | Verdict |
|---|---|
| New forward migration duplicating CRM DDL | Rejected — large duplicate, drift from foundation |
| Only `resolve --rolled-back` on `crm05a` without foundation rollback | Insufficient — foundation stays “applied” with no tables |
| Manual `CREATE TABLE CrmImportJob` only | Rejected — entire CRM layer missing, not one table |

## Related

- [`BATCH39A-STAGING-MIGRATION-BOM-RECOVERY.md`](BATCH39A-STAGING-MIGRATION-BOM-RECOVERY.md)
