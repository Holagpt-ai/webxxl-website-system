# BATCH39H — Comms foundation / integrity migration consolidation

**Status:** MERGED via [PR #99](https://github.com/Holagpt-ai/webxxl-website-system/pull/99) @ `691e0e52e95d003d78e209f39d2f885251f913ed` (PR #98 closed superseded). **Baseline `main` at authoring:** `2590565f3b3a705097f3484345e19dae4af2b967`  
**Scope:** Repository SQL + CI guard only. **No** staging DB writes in this batch.

## Overlap analysis

| Object | In `comms06_foundation` | Was in `comms06a_integrity` (pre-39H) | 39H action |
|---|---|---|---|
| `CommsWebhookProcessingStatus` + `PROCESSING` | CREATE TYPE | ADD VALUE (removed 39G) | N/A |
| `CommsWebhookReceipt.tenantMappingId` | CREATE TABLE | ADD COLUMN | **Removed** |
| `externalAccountId`, `eventDedupeKey`, `relayTimestampSeconds`, `claimedAt`, `claimedBy` | CREATE TABLE | ADD COLUMN | **Removed** |
| `CommsWebhookReceipt_eventDedupeKey_key` | CREATE UNIQUE INDEX | CREATE UNIQUE INDEX | **Removed** |
| `CommsWebhookReceipt_providerKey_providerInstanceId_externalA_idx` | CREATE INDEX | CREATE INDEX | **Removed** |
| `CommsWebhookReceipt_providerKey_externalEventId_key` | **Not** in foundation | DROP INDEX | **Kept** as `DROP INDEX IF EXISTS` (legacy DBs only) |

## Dependent migrations

Later migrations (`seo07`, `mkt08`, wallet, commerce, analytics, batch28/37) do **not** reference comms06a-specific DDL; they depend on comms tables existing from **foundation** only.

## Regression guard

**`REDUNDANT_MIGRATION_DDL`** — blocks `ADD COLUMN` / `CREATE INDEX` when the same table column or index name already appeared in an earlier migration folder.

## Post-merge staging recovery — COMPLETE on staging

Staging execution is **COMPLETE**: **39/39** on `vcgibefnhneaqhcguhnt` ([rollout result](BATCH40-STAGING-ROLLOUT-RESULT.md)). Production apply stays **UNVERIFIED**. The numbered steps are the procedure that was used. They are not a new authorization to rerun it.

**Do not** use `migrate resolve --applied` to skip defective SQL. After **39H** landed in PR #99:

1. Preflight `supabase:vcgibefnhneaqhcguhnt/postgres`.
2. Confirm failed row for `20261018220000_comms06a_integrity` (22 finished, 16 pending).
3. `pnpm exec prisma migrate resolve --rolled-back 20261018220000_comms06a_integrity` if still in failed state.
4. `pnpm exec prisma migrate deploy` — expect comms06a to run **only** idempotent legacy index drop, then **16** remaining migrations.
5. Verify **39/39**; `PILOT_READINESS_DB_PROBE=1 pnpm release:readiness`.

## Related

- [`BATCH39G-PHASE2-STAGING-RESULT.md`](BATCH39G-PHASE2-STAGING-RESULT.md)
