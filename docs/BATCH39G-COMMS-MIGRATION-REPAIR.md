# BATCH39G — Comms migration repair (repository + proposed staging recovery)

**Status:** IN PR · **Baseline `main`:** `a0d03aa2324a17d655bb1929e20f3fb1c3fdd810`  
**Staging:** `vcgibefnhneaqhcguhnt` · **Production:** not accessed in Phase 1

## Phase 1 — Repository repair (this PR)

### Defect

`20261018210000_comms06_foundation` creates:

```sql
CREATE TYPE "CommsWebhookProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'DUPLICATE');
```

`20261018220000_comms06a_integrity` previously executed:

```sql
ALTER TYPE "CommsWebhookProcessingStatus" ADD VALUE 'PROCESSING';
```

On a clean deploy this raises Postgres **42710** (Batch 39F evidence).

### Correction

Removed **only** the redundant `ALTER TYPE … ADD VALUE 'PROCESSING'` from `comms06a_integrity`. All other SQL unchanged (columns, indexes, drop index).

### Chain scan (ADD VALUE)

| Migration | Assessment |
|---|---|
| `comms06a_integrity` | **Fixed** — duplicate removed |
| `mkt08_foundation` | OK — new labels on `MarketingRequestStatus` from `social04_marketing_studio` |
| `analytics14_foundation` | OK — `WEBXXL_EVENTS` not in `seo07_foundation` enum |
| `ProjectActivityEventType` increments | OK — single new label per migration |

### Regression guard

`findDuplicateEnumAddValueIssues()` — blocking code **`DUPLICATE_ENUM_ADD_VALUE`** in `validateMigrationOrderingSafeguards()` / `release:readiness --verify-ordering`.

### Migration risk (post-fix)

| Risk | Level | Notes |
|---|---|---|
| Clean empty DB deploy | **Low** | Enum label no longer duplicated |
| Staging with failed `comms06a` row | **Medium** | Requires Phase 2 resolve + redeploy; migration SQL **edited** after partial failure — owner authorization |
| Production | **UNVERIFIED** | Confirm history before any production deploy |

## Phase 2 — Staging recovery (NOT executed in Phase 1)

**Requires:** PR #39G merged + separate owner authorization.

1. Load `.env.staging.local`; preflight `supabase:vcgibefnhneaqhcguhnt/postgres`.
2. Confirm **22** finished migrations + **failed** `20261018220000_comms06a_integrity` (39F state).
3. Inspect partial objects: failed migration failed on **first statement** (enum add) — expect **no** integrity columns/indexes from 39G SQL unless a later manual change occurred.
4. If inventory matches expectation:

   ```bash
   pnpm exec prisma migrate resolve --rolled-back 20261018220000_comms06a_integrity
   pnpm exec prisma migrate deploy
   ```

5. Verify **39/39** finished rows, CRM + comms tables, `PILOT_READINESS_DB_PROBE=1 pnpm release:readiness`.

**Do not:** reset DB, `DROP SCHEMA public CASCADE`, manual `_prisma_migrations` SQL edits.

## Related

- [`BATCH39F-STAGING-REHEARSAL-RESULT.md`](BATCH39F-STAGING-REHEARSAL-RESULT.md)
- [`BATCH39F-STAGING-BASELINE-SNAPSHOT.md`](BATCH39F-STAGING-BASELINE-SNAPSHOT.md)
