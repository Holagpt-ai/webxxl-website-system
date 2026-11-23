# BATCH 13 — SEO & local intelligence HTTP integration

**Status:** MERGED [PR **#150**](https://github.com/Holagpt-ai/webxxl-website-system/pull/150) @ `e7f51fe261d24220549a96a58a93d81100e74f3c`. **Baseline:** PR **#149** (Batch 12).

## Scope

Closes Batch 16 §7 SEO HTTP gaps for stored intelligence, crawl status, Google readiness handoff contracts, and dashboard-context wiring. No live Google OAuth, crawl execution, rank provider ingest, or opportunity execution.

## New / extended customer routes

| Surface | Method | Path |
|---|---|---|
| Per-query keyword intelligence | GET | `/api/v1/seo/sites/{siteId}/keywords/intelligence?query=&page=&date=` |
| Competitor analysis detail | GET | `/api/v1/seo/sites/{siteId}/competitors/{competitorId}` |
| Crawl run list | GET | `/api/v1/seo/sites/{siteId}/crawl-runs` |
| Crawl run status / result | GET | `/api/v1/seo/sites/{siteId}/crawl-runs/{runId}` |
| Google OAuth handoff contract | GET | `/api/v1/seo/sites/{siteId}/google/oauth-handoff` |
| Connections authorization | GET | `/api/v1/seo/sites/{siteId}/connections` | adds `authorization` envelope |

Existing `POST .../scan-previews` remains the crawl **prepare** entry; crawl-runs routes expose honest stored status (`liveCrawlOccurred: false`).

## Dashboard context (Batch 10B extension)

- `crossModule.seoWorkspaces` — Local SEO nav paths.
- `local_seo` module `apis` — site-scoped SEO intelligence endpoints (placeholder `{managedSiteId}` resolved when active site present).

## Gates (unchanged)

- `SEO_BACKEND_ENABLED`, OPEN-001 `core.local-seo`, `GOOGLE_PROVIDER_READINESS_ENABLED`, crawler and provider API flags.
- OAuth start remains **off** (`oauthConnectionEnabled: false`).

## Tests

`__tests__/platform/batch13-seo-local-intelligence.test.ts` plus focused SEO regression (`seo19a-stored-intelligence`, `batch2-site-intelligence`, `batch10b-customer-dashboard-integration`).

## Deferred

- Live Google OAuth connect HTTP
- `SEO_CRAWLER_ENABLED` production crawl
- Opportunity accept/dismiss/execute
- Live rank / Places discovery
- AUTH-STAGING-8C customer browser matrix