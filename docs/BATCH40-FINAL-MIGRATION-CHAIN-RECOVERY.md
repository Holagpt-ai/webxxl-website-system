# BATCH40 — Final migration chain recovery (consolidated)

**Status:** IN PR · **Baseline `main`:** `2590565f3b3a705097f3484345e19dae4af2b967`  
**Scope:** One PR superseding piecemeal 39G/39H patches. **No** staging/production DB access in this batch.

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

## Post-merge staging recovery (owner — not in this batch)

1. Preflight `supabase:vcgibefnhneaqhcguhnt/postgres`.
2. If `comms06a_integrity` failed: `migrate resolve --rolled-back 20261018220000_comms06a_integrity`.
3. `pnpm exec prisma migrate deploy` through **39/39**.
4. `PILOT_READINESS_DB_PROBE=1 pnpm release:readiness`.

Supersedes open PR **#98** (same comms consolidation, included here).

## Related

- [`BATCH39G-PHASE2-STAGING-RESULT.md`](BATCH39G-PHASE2-STAGING-RESULT.md)
- [`BATCH39H-COMMS-MIGRATION-CONSOLIDATION.md`](BATCH39H-COMMS-MIGRATION-CONSOLIDATION.md)
