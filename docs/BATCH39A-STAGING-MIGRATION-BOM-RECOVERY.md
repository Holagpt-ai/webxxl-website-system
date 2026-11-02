# BATCH39A — Prisma migration BOM repair and staging recovery (documentation)

**Status:** IN PR · **Baseline `main`:** `965eca9f384823f66302c8bb08d38c71642acbd9`  
**Scope:** Repository SQL encoding fix + CI guard + **documented** staging recovery. **No** database writes from this batch.

## Failure evidence (staging `vcgibefnhneaqhcguhnt`, 2026-11-02)

| Item | Evidence |
|---|---|
| Command | `pnpm exec prisma migrate deploy` (owner-authorized, staging only) |
| Error | Prisma **P3018** / Postgres **42601** — syntax error at U+FEFF before `-- CreateSchema` |
| Root cause | UTF-8 BOM (`EF BB BF`) at start of `20251008120000_customer_portal_core/migration.sql` |
| Repo scan | **2** of **39** `migration.sql` files contained BOM (portal core + comms06 foundation) |

## Staging partial state (read-only inventory after failure)

| Object | Present? |
|---|---|
| Public base tables | **`_prisma_migrations` only** |
| Public enums (`UserRole`, etc.) | **None** |
| Portal tables (`User`, `CustomerAccount`, …) | **None** — first migration SQL did not execute |
| `_prisma_migrations` rows | **1** — `20251008120000_customer_portal_core` **failed / unfinished** |

The failed migration’s intended schema is defined in `prisma/migrations/20251008120000_customer_portal_core/migration.sql` (enums + 18 portal tables). **None** of those application objects exist on staging; only Prisma’s migration history table was created.

## Minimum safe cleanup (staging only — owner executes)

**Production (`txfxeehglqfszletuumn`) must not be used.**

1. Load gitignored `.env.staging.local`; confirm preflight identity `supabase:vcgibefnhneaqhcguhnt/postgres`.
2. Optional: Supabase dashboard backup / logical dump.
3. **No portal table drops required** — they were never created.
4. Mark the failed migration rolled back so deploy can retry:

   ```bash
   pnpm exec prisma migrate resolve --rolled-back 20251008120000_customer_portal_core
   ```

   Use this when no migration SQL from that folder was applied (matches current staging inventory).

5. Merge **Batch 39A** (BOM stripped in Git) onto the branch used for deploy.
6. Re-run **`pnpm exec prisma migrate deploy`** (full pending chain, staging only).
7. Verify: `_prisma_migrations` row count, `PILOT_READINESS_DB_PROBE=1 pnpm release:readiness`.

**Do not** use `prisma migrate reset`, `db push`, or manual deletion of `_prisma_migrations` unless a separate owner runbook authorizes it.

### If cleanup diverges from inventory above

If read-only inventory shows portal tables **or** enums from the first migration, stop and run an owner-reviewed SQL rollback of **only** objects created by that failed migration before `migrate resolve --rolled-back`. Do not apply this batch’s Git fix alone without reconciling drift.

## Duplicate timestamp prefix (20261031120000)

Two folders share the 14-character prefix `20261031120000`:

- `20261031120000_batch28a_managed_site_leads`
- `20261031120000_mkt25_crm_audience_planning`

Prisma applies migrations in **lexicographic order by full folder name**. `_batch28a_…` sorts before `_mkt25_…`. This is **deterministic** and **not unsafe** for deploy order; the safeguard emits **warning-only** `DUPLICATE_TIMESTAMP_PREFIX` (non-blocking). Renaming migration folders requires separate owner authorization (would change migration names in history).

## CI guard

`validateMigrationOrderingSafeguards()` fails with **`UTF8_BOM_IN_SQL`** if any `migration.sql` starts with BOM; **`SINGLE_LINE_MIGRATION_SQL`** and **`INLINE_PRISMA_COMMENT_DDL`** catch Postgres comment-swallowed DDL (Batch 39C/39E); **`DUPLICATE_ENUM_ADD_VALUE`** catches redundant `ALTER TYPE ADD VALUE` (Batch 39G); **`REDUNDANT_MIGRATION_DDL`** catches duplicate columns/indexes across migrations (Batch 39H); **`UNGUARDED_SUPABASE_REVOKE`** catches bare `REVOKE FROM anon` (Batch 40). Wired in `pnpm release:readiness --verify-ordering` and application validate workflow. Full-chain local proof: `pnpm migration:chain-rehearsal`.

## Related

- [`STAGING-SUPABASE-BINDING.md`](STAGING-SUPABASE-BINDING.md)
- [`BATCH38-RELEASE-READINESS.md`](BATCH38-RELEASE-READINESS.md)
