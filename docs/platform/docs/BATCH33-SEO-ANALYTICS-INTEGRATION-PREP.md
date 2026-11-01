# Batch 33 — SEO & Analytics Google Integration Preparation V1

**Baseline:** `main` @ `b8e58dfc7a1520cb927e67785137734d4ed3d637` (PR #83 merged). **No** live Google OAuth, production migrations, provider fetch activation, or customer data mutation.

## Scope

Reuse SEO-07 `SiteAnalyticsConnection`, GSC authorization (`gsc-query-auth`, `property-match`), and ANALYTICS-14/15 ingestion gates. Add stored **connection readiness** for **GSC**, **GA4**, and **GBP** with provenance, credential lifecycle checks, and tenant boundaries.

| Workstream | Location |
|---|---|
| Readiness core | `lib/platform/google/*`, `config/google-integration.ts` |
| SEO HTTP | `GET /api/v1/seo/sites/{siteId}/google/readiness`, `POST …/google/readiness/assess` |
| Analytics HTTP | `GET /api/v1/analytics/accounts/{accountId}/google/readiness` |
| Provider adapters | `google-ga4-seo.ts`, `google-gbp-seo.ts` (connection-boundary deps) |
| Tests | `__tests__/platform/batch33-google-provider-readiness.test.ts` |

## Flags (source default OFF)

| Flag | Purpose |
|---|---|
| `GOOGLE_PROVIDER_READINESS_ENABLED` | Exposes readiness GET/assess APIs |
| `SEO_*_API_ENABLED`, `SEO_GOOGLE_OAUTH_ENABLED` | Platform capability gates (no live OAuth in this batch) |
| `ANALYTICS_INGESTION_ENABLED`, `ANALYTICS_PROVIDER_FETCH_ENABLED`, `WORKFLOW_EXTERNAL_EFFECTS_ENABLED` | Unchanged; GSC live fetch still gated |

## Supported vs deferred

| Provider | Stored read (existing) | Readiness assess | Provider ingest | Live fetch |
|---|---|---|---|---|
| GSC | Yes | Yes | When ingestion + flags ON | When transport + flags ON |
| GA4 | Yes (metrics when present) | Yes | **NOT_SUPPORTED** | **NOT_SUPPORTED** |
| GBP | Yes (metrics when present) | Yes | **NOT_SUPPORTED** | **NOT_SUPPORTED** |

## Owner authorization still required

1. Google Cloud OAuth consent + WebXXL redirect URIs (staging/production).
2. Owner-connected Search Console, GA4, and Business Profile properties per managed site.
3. Staging `prisma migrate deploy` before persisting connections in non-fixture DBs.
4. Enable provider API flags on **staging only** before pilot ingest.

## Batch 33.1 safety (PR #84)

| Control | Behavior |
|---|---|
| Idempotency | Client `Idempotency-Key` (8–128 chars) hashed into `google-readiness:v1:{account}:{site}:{provider}:{digest}` |
| Ingestion isolation | Readiness rows use status `READINESS` + `dataState NOT_CONNECTED`; never overwrite ingestion sync runs |
| POST auth | `seo.configure` (OWNER); OPEN-001 gate unchanged |
| Account GET bound | DB `take: N+1` lookahead; `count` only when truncated; connections scoped to selected site ids |
| Concurrency | Readiness persist: create + `P2002` replay; updates via `updateMany` where `status = READINESS` only |

## ADR

Not required — extends SEO-07 and ANALYTICS-14/15 without architectural change.
