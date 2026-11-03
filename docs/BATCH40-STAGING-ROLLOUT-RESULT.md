# BATCH40 — Staging migration rollout (final recovery)

**Date:** 2026-11-03 · **`main`:** `691e0e52e95d003d78e209f39d2f885251f913ed` ([PR #99](https://github.com/Holagpt-ai/webxxl-website-system/pull/99) merged)  
**Staging:** `vcgibefnhneaqhcguhnt` · **Production:** not accessed (`txfxeehglqfszletuumn`)

## Preflight — PASS

| Check | Result |
|---|---|
| Staging identity | `supabase:vcgibefnhneaqhcguhnt/postgres` |
| Production collision | PASS (`WEBXXL_PRODUCTION_DATABASE_IDENTITY` distinct; preflight pair OK) |
| Postgres | **17.11** (Supabase host) |
| Boundaries | `WEBXXL_STAGING_BOUNDARIES_CONFIRMED=1` |

## Pre-deploy state (confirmed)

| Metric | Value |
|---|---:|
| Successfully finished migrations | **22** |
| Failed (active) | **`20261018220000_comms06a_integrity`** (1) |
| Historical rolled-back rows for comms06a | 1 (from prior 39G Phase 2) |
| Partial comms06a-only DDL from latest failure | **None** — `CommsWebhookReceipt.tenantMappingId` / `eventDedupeKey` already from `comms06_foundation` |
| `CrmImportJob` | Present |

## Actions executed

| Step | Result |
|---|---|
| Close PR #98 (superseded) | **Closed** — not merged |
| `migrate resolve --rolled-back 20261018220000_comms06a_integrity` | **SUCCESS** (2026-11-03) |
| `npx prisma migrate deploy` | **SUCCESS** — **17** pending migrations applied (comms06a + seo07 through batch37) |

## Post-deploy state

| Metric | Value |
|---|---:|
| Repository migration folders | **39** |
| Finished migrations (non–rolled-back) | **39** |
| Failed / pending | **0** |
| `prisma migrate status` | Database schema is up to date |
| `_prisma_migrations` rows | **41** (includes **2** historical rolled-back comms06a attempts + **1** successful comms06a apply) |

### Spot checks (public schema)

| Object | Present |
|---|---|
| `CrmImportJob` | yes |
| `CommsWebhookReceipt` (integrity columns) | `tenantMappingId`, `eventDedupeKey` |

## Release readiness

```bash
PILOT_READINESS_DB_PROBE=1 pnpm release:readiness   # via npx tsx on staging env
```

| Result | Detail |
|---|---|
| Pilot module migrations | **PASS** — all expected finished |
| Full repository migration chain | **PASS** — 39/39 |
| Migration ordering safeguards | **PASS** (informational `DUPLICATE_TIMESTAMP_PREFIX` note retained) |
| Overall controlled pilot ready | **false** — expected: `[BLOCKED]` authenticated staging smoke; flags/providers OFF in local run; no Vercel deploy in this batch |

## Closeout record (continuity)

| Fact | Status |
|---|---|
| Main baseline | `691e0e52e95d003d78e209f39d2f885251f913ed` |
| Staging migrations | **39/39** successful on `vcgibefnhneaqhcguhnt` |
| PostgreSQL (staging) | **17.11** |
| Migration readiness (`PILOT_READINESS_DB_PROBE=1`) | **PASS** (pilot + full chain probes) |
| Authenticated EN/ES pilot smoke | **PENDING** (owner) |
| Production migration / deployment | **UNVERIFIED** — production DB not accessed |
| Feature flags and providers | **OFF** — unchanged; no activation in this batch |

## Remaining blockers (not migration)

- Authenticated EN/ES customer dashboard smoke on staging/preview (owner).
- Module backend flags and provider activation remain OFF until separate owner authorization.
- Production database and migrate deploy **not** in scope.

**Do not:** reset staging, `resolve --applied` bypass, production access.
