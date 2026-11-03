# BATCH40 — Final migration chain recovery (consolidated)

**Status:** MERGED · **PR:** [#99](https://github.com/Holagpt-ai/webxxl-website-system/pull/99) @ `691e0e52e95d003d78e209f39d2f885251f913ed`  
**Staging rollout:** [`BATCH40-STAGING-ROLLOUT-RESULT.md`](BATCH40-STAGING-ROLLOUT-RESULT.md) — **39/39** on `vcgibefnhneaqhcguhnt` (2026-11-03). Production not accessed.

## Defects fixed (repository)

| Defect | Migration(s) | Fix |
|---|---|---|
| Duplicate enum `PROCESSING` | `comms06a_integrity` (39G) | Removed `ADD VALUE` |
| Redundant columns/indexes vs foundation | `comms06a_integrity` (39H) | Kept only `DROP INDEX IF EXISTS` legacy index |
| `anon` / `authenticated` REVOKE on plain Postgres | `restrict_supabase_api_access`, `website_preview` | Wrapped in `DO $$ … IF EXISTS (pg_roles)` |
| No local full-chain proof | — | `pnpm migration:chain-rehearsal` (optional `embedded-postgres` install) |

## Local rehearsal evidence

```bash
pnpm add -D embedded-postgres@18.6.0-beta.19   # local only — omitted from CI/Vercel install graph
pnpm migration:chain-rehearsal
```

Engine: **embedded-postgres** (PostgreSQL **18.6** binary on Windows dev host)  
Result: **`prisma migrate deploy` — 39/39 applied**, no pending migrations (Batch 40 dev run).

### Environment vs Supabase staging

| Aspect | Local embedded | Supabase `vcgibefnhneaqhcguhnt` |
|---|---|---|
| Postgres major | **18** (embedded bundle) | **15** (typical Supabase; verify in dashboard) |
| `anon` / `authenticated` roles | Absent — revoke migrations **no-op** | Present — revokes **apply** |
| Extensions (`pgcrypto`, etc.) | Minimal default | Supabase-managed set |
| Session pooler | N/A | Required for some networks |

Rehearsal proves **SQL portability** and **ordering**; post-merge staging deploy still requires owner authorization and preflight.

## Regression safeguards (CI)

- `DUPLICATE_ENUM_ADD_VALUE` (39G)
- `REDUNDANT_MIGRATION_DDL` (39H)
- **`UNGUARDED_SUPABASE_REVOKE`** (40)
- Existing BOM / single-line / inline-comment guards (39A–39E)

## Post-merge staging recovery — COMPLETE

Executed 2026-11-03 per [`BATCH40-STAGING-ROLLOUT-RESULT.md`](BATCH40-STAGING-ROLLOUT-RESULT.md). PR **#98** closed superseded (not merged).

## Related

- [`BATCH39G-PHASE2-STAGING-RESULT.md`](BATCH39G-PHASE2-STAGING-RESULT.md)
- [`BATCH39H-COMMS-MIGRATION-CONSOLIDATION.md`](BATCH39H-COMMS-MIGRATION-CONSOLIDATION.md)
