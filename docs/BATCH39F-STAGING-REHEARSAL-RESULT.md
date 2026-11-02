# BATCH39F — Clean staging reset & migration rehearsal (result)

**Date:** 2026-11-02 · **`main`:** `a0d03aa2324a17d655bb1929e20f3fb1c3fdd810` (PR #96 merged)  
**Staging:** `vcgibefnhneaqhcguhnt` · **Production:** not accessed

## Preflight

| Check | Result |
|---|---|
| Staging identity | `supabase:vcgibefnhneaqhcguhnt/postgres` |
| Production collision guard | PASS |
| CustomerAccount / User rows (pre-reset) | **0** / **0** |
| Pre-reset baseline snapshot | [`BATCH39F-STAGING-BASELINE-SNAPSHOT.md`](BATCH39F-STAGING-BASELINE-SNAPSHOT.md) |

## Reset method (authorized staging-only)

**Not used:** `prisma migrate reset`, `DROP SCHEMA public CASCADE`.

**Used:** targeted cleanup of **`public`** schema only:

1. `DROP TABLE` every table in `public` (including `_prisma_migrations`) via dynamic SQL + `CASCADE`.
2. `DROP TYPE` for all `public` enum types.
3. `DROP SEQUENCE` for orphaned `public` sequences.

**Preserved:** `auth`, `storage`, `realtime`, `vault`, `graphql`, `graphql_public`, and all non-`public` tables (41 non-public tables observed; not modified).

**Objects affected:** 71 public tables, public enum types, `_prisma_migrations` (22 historical rows removed with table drop).

**Post-reset verification:** 0 public tables, 0 public enums, no `_prisma_migrations` table.

## Repository safeguards (pre-deploy)

`release:readiness --verify-ordering` — **PASS** (39 folders; duplicate-prefix advisory only).

## `prisma migrate deploy`

**Stopped** on first failure (per runbook — no auto-repair).

| Metric | Value |
|---|---:|
| Migrations applied successfully | **22** |
| Failed migration | **`20261018220000_comms06a_integrity`** |
| Pending after failure | **16** |
| Target chain total | **39** |

### Sanitized error

- **Prisma:** P3018 (migration failed to apply)
- **Postgres:** `42710` — `enum label "PROCESSING" already exists`
- **Statement:** `ALTER TYPE "CommsWebhookProcessingStatus" ADD VALUE 'PROCESSING';`

### Root cause (repository)

`20261018210000_comms06_foundation` already defines `"CommsWebhookProcessingStatus"` with label **`PROCESSING`**.  
`20261018220000_comms06a_integrity` repeats `ADD VALUE 'PROCESSING'` — non-idempotent on a clean deploy.

## Post-failure verification

| Check | Result |
|---|---|
| `CrmImportJob` table | **Present** (CRM foundation + integrity applied on clean chain) |
| Finished `_prisma_migrations` rows | **22** |
| Full 39/39 chain | **No** |

## Release readiness

`PILOT_READINESS_DB_PROBE=1 pnpm release:readiness` @ `a0d03aa`:

- **Overall controlled pilot ready:** **false**
- **FAIL:** Pilot module migrations / full repository migration chain (incomplete)
- **PASS:** Migration ordering safeguards (repository)
- Flags/providers: source-default OFF (unchanged)

## Blocker / next owner action

1. **Repository fix:** Batch **39G** PR — remove duplicate `ADD VALUE 'PROCESSING'` from `comms06a_integrity` (see [`BATCH39G-COMMS-MIGRATION-REPAIR.md`](BATCH39G-COMMS-MIGRATION-REPAIR.md)).
2. **Staging recovery (Phase 2):** after 39G merge + owner authorization — `migrate resolve --rolled-back 20261018220000_comms06a_integrity` then `migrate deploy` for remaining **16** migrations.
3. Production migrations remain **UNVERIFIED**.

## Related

- [`BATCH39D-STAGING-RECOVERY-RESULT.md`](BATCH39D-STAGING-RECOVERY-RESULT.md) (superseded forensic state — pre-39F snapshot archived in BATCH39F baseline doc)
- [`BATCH39E-CLEAN-MIGRATION-REHEARSAL-PREP.md`](BATCH39E-CLEAN-MIGRATION-REHEARSAL-PREP.md)
