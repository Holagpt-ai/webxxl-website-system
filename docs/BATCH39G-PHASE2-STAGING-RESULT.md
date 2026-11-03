# BATCH39G Phase 2 — Staging migration completion (stopped @ comms06a re-apply)

**Date:** 2026-11-02 · **`main`:** `2590565f3b3a705097f3484345e19dae4af2b967` (PR #97 merged)  
**Staging:** `vcgibefnhneaqhcguhnt` · **Production:** not accessed

## Preflight — PASS

| Check | Result |
|---|---|
| Staging identity | `supabase:vcgibefnhneaqhcguhnt/postgres` |
| Production collision | PASS |
| Pre-recovery migrations | **22** finished, **1** failed (`20261018220000_comms06a_integrity`) |
| `CrmImportJob` | Present |
| `CommsWebhookReceipt` integrity columns | **Already present** (from `comms06_foundation`; comms06a failed on first statement in 39F — no comms06a-only partial DDL) |

## Actions executed

| Step | Result |
|---|---|
| `migrate resolve --rolled-back 20261018220000_comms06a_integrity` | **SUCCESS** |
| `migrate deploy` | **FAILED** — P3018 on **`20261018220000_comms06a_integrity`** |

### Sanitized deploy error

- **Postgres:** `42701` — `column "tenantMappingId" of relation "CommsWebhookReceipt" already exists`
- **Cause:** `comms06_foundation` already creates `tenantMappingId`, `eventDedupeKey`, related indexes; fixed `comms06a_integrity` still attempts redundant `ADD COLUMN` / `CREATE INDEX` when re-applied.

## Post-failure state

| Metric | Value |
|---|---:|
| Successfully finished migrations | **22** |
| Failed (again) | **`20261018220000_comms06a_integrity`** |
| Pending | **16** (seo07 through batch37) |
| Full chain **39/39** | **No** |

## Release readiness

`PILOT_READINESS_DB_PROBE=1 pnpm release:readiness` — **overall controlled pilot ready: false** (migration chain incomplete).

## Recommended next step

Batch **39H** consolidates redundant comms06a DDL into foundation parity (see [`BATCH39H-COMMS-MIGRATION-CONSOLIDATION.md`](BATCH39H-COMMS-MIGRATION-CONSOLIDATION.md)). After merge: `resolve --rolled-back` if needed, then `migrate deploy` — **not** `resolve --applied`.

**Do not:** reset DB, manual `_prisma_migrations` SQL, production access.
