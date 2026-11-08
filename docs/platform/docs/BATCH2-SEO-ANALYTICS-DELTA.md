# Batch 2 — SEO & Analytics Intelligence (implementation delta)

**Status:** Issue **#114** implementation in owner-review PR. **Baseline `main`:** `52e6bb631d5b8621f737d1fe7f3a8050a0d82a08` (Batch 1 PR #112 merged).

## Delta matrix

| Item | Merged / complete in source | Missing before Batch 2 | Batch 2 delivery | Runtime / QA |
|---|---|---|---|---|
| Per-site SEO overview | `GET /api/v1/seo/sites/{id}/overview` | No single per-site compose with analytics + readiness | `GET /api/v1/site-intelligence/sites/{id}/summary` | Read stored data only |
| Per-site analytics overview | `GET /api/v1/analytics/accounts/{id}/overview?siteId=` | Same | Embedded `analytics` slice | Ingestion flags OFF |
| Google readiness | Batch 33 GET assess | Not composed with SEO/analytics context | `googleReadiness` slice when module flag ON | `GOOGLE_PROVIDER_READINESS_ENABLED` default OFF |
| Unified UI | v0 SEO + Analytics dashboards | Cross-panel rollup | **v0** optional per contract | Browser E2E → Batch 8 |

## Non-goals

Duplicate crawler, competitor engine, GSC normalizer, BI store, or OAuth activation.
