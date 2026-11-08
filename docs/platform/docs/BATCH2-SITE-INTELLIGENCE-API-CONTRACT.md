# Batch 2 — Per-site SEO & Analytics Intelligence API contract

**Issue:** #114 · **ADR:** not required (read-model composition over SEO-07, ANALYTICS-14/15, Batch 33).

## Route

`GET /api/v1/site-intelligence/sites/{siteId}/summary`

### Query

| Param | Required | Description |
|---|---|---|
| `start` | No | Analytics window start `YYYY-MM-DD` (default: end − 27 days) |
| `end` | No | Analytics window end `YYYY-MM-DD` (default: today UTC) |
| `customerAccountId` | No | If present, must match session account or `403` |

### Auth

- Session `requireCustomerMembership`
- Managed site must belong to session `CustomerAccount` (`404` if not)
- OPEN-001: SEO slice requires `core.local-seo`; Analytics slice requires `core.analytics` (each may be `UNAVAILABLE` without failing the whole response when the site exists)

### Response

`{ summary: SiteIntelligenceSummaryResponse }` — see `lib/platform/site-intelligence/types.ts`.

| Slice | Source (reused) | Notes |
|---|---|---|
| `seo` | `loadSeoSiteOverview` | GSC avg position label unchanged; competitors carry `source` |
| `analytics` | `buildAnalyticsOverview` | GA4 `traffic` vs GSC `search` remain separate DTO sections |
| `googleReadiness` | `buildGoogleAccountReadiness` (site-scoped) | Same **SEO** gate as `GET /api/v1/seo/sites/{siteId}/google/readiness` (`seo.read` + OPEN-001 `core.local-seo` + `SEO_BACKEND_ENABLED`); module flag `GOOGLE_PROVIDER_READINESS_ENABLED` additionally required |

`analyticsDateRange` on the response applies **only** to the `analytics` slice (`start`/`end` query params). The `seo` slice retains each provider’s stored `dateRange` / `observedAt` inside `seo.data` (not aligned to the query window).

`provenanceNotice` documents that metrics must not be blended across providers.

### v0 handoff (Cursor does not edit these paths)

Optional unified SEO/Analytics workspace panel:

- **Paths:** `app/[locale]/dashboard/seo/**`, `app/[locale]/dashboard/analytics/**`, related `components/**` (not `dashboard/business/**` — Issue #113).
- **Fetch:** `GET /api/v1/site-intelligence/sites/{siteId}/summary?start=&end=`
- **UI:** render each slice only when `status === 'AVAILABLE'`; show `reasonCode` + `message` otherwise; never sum GSC clicks with GA4 sessions.

### Runtime gates (unchanged)

No live Google fetch, crawler, paid rank APIs, migrations, or flag activation in this batch.
