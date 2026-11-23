# v0 — Batch 13 Local SEO HTTP (presentation only)

Backend on Cursor-owned paths. Do **not** edit `app/api/**` or `lib/platform/seo/**`.

## Wire APIs

| Screen | API |
|---|---|
| Keywords table | `GET /api/v1/seo/sites/{siteId}/keywords` (existing) |
| Keyword drill-down | `GET /api/v1/seo/sites/{siteId}/keywords/intelligence?query=` optional `page`, `date` |
| Competitor card | `GET /api/v1/seo/sites/{siteId}/competitors` + `GET .../competitors/{id}` |
| Pages / crawl | `POST .../scan-previews` then poll `GET .../crawl-runs` and `GET .../crawl-runs/{runId}` |
| Connections | `GET .../connections` → `authorization` + `GET .../google/oauth-handoff` |
| Readiness | `GET .../google/readiness` (existing) |

## UI states

- `dataState` / `observations[]` empty → honest empty, not zero placeholders.
- `authorization.oauthConnectEnabled === false` → disabled connect CTA with deferred reason.
- Crawl: `liveCrawlOccurred: false` — never claim a crawl ran when status is `PREPARED` or `BLOCKED`.
- Keyword intelligence `provenance: STORED_GSC_OBSERVATION` — show `measuredAt` and limitations.

## Dashboard context

Use `GET /api/v1/portal/dashboard-context` → `crossModule.seoWorkspaces` and `modules[].apis` for `local_seo` when site selected.

EN/ES: reuse `local-seo-workspace-*` dictionaries; GSC average position disclaimer unchanged.