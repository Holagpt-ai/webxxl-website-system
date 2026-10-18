# 09 — FREE Local SEO, Google Connections, Competitor Intelligence & AI Execution

**Business policy:** A site-specific, source-based local SEO dashboard and AI execution are included/FREE for eligible WebXXL customers. Scope applies to **every managed website/landing page**, across industries and markets, with per-site business context and separate Google properties. No fabricated keyword ranks or competitor positions.

## 1. Data provenance and correct metrics

| Data source | Verified measurable capabilities | Important limitation |
|---|---|---|
| Google Search Console (GSC) | Organic clicks, impressions, CTR, **average** position by property, query/page/device/country/date; index-related APIs | Average position is not a fixed SERP rank or local-map rank; quotas/sampling/truncation/delay |
| Google Analytics 4 (GA4) | Sessions, engagement, conversions, acquisition and locations when data/consent settings permit | GA4 sessions ≠ GSC clicks; property connection and event schema required |
| Google Business Profile Performance | Business location/listing interactions, search keyword impression/performance where available | Owner-access and API approval required; not arbitrary competitor insights |
| Google Places API | Nearby relevant business identity, category, place metadata/review summary under API fields | Text/nearby search result ordering is **not** a local keyword rank-grid measurement; storage/ToS restrictions |
| Local SERP ranking provider (TBD) | Keyword + coordinate + device + timestamp rank observations / map grids | Paid API terms/cost; claims require source, methodology and freshness |
| WebXXL crawl/website repo | Pages and routes, titles, H1, meta/schema, internal links, broken links, Lighthouse/performance where instrumented | Crawl inventory ≠ Google indexing; can report only observed pages and source revision |
| Published WebXXL work records | Pages created/modified, approved deployments, agent changes | Count completed pages only after verified publish/revision event |

Official references: [Search Console Search Analytics](https://developers.google.com/webmaster-tools/v1/searchanalytics/query), [GSC usage quotas](https://developers.google.com/webmaster-tools/limits), [GSC + GA4 differences](https://developers.google.com/search/docs/monitor-debug/google-analytics-search-console), [Google Places Text Search](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places/searchText), [Google Analytics Data API](https://developers.google.com/analytics/devguides/reporting/data/v1), [Business Profile Performance API](https://developers.google.com/my-business/reference/performance/rest).

## 2. Per-site onboarding and auth

Business owner chooses specific `ManagedSite`, verifies public/canonical URL and market/service category, connects authorized GSC property and optional GA4/GBP OAuth, selects relevant GBP location(s) and service/geography, accepts read scopes, and may add chosen SEO competitor keywords. All credentials stored as encrypted secret references, per account/site with revocation. Backend uses least required OAuth scopes and verifies that connected property belongs to chosen site. No cross-account Google token reuse without explicit owner authorization and proper access controls.

## 3. Core dashboard cards and supporting calculations

1. `Published pages`: count URLs validated in site page inventory or verified managed-site deployment, with source revision/date. Do not say 'indexed' without Google confirmation.
2. `Organic clicks`, `impressions`, `CTR`, `average position`: measured GSC date range, property and dimensions; data delayed where Google has not finalized it.
3. `Organic traffic`, engagement and conversions: GA4 property/date and attribution with caveat; do not equate to GSC clicks.
4. `Local visibility`: verified GBP metrics and/or licensed keyword/geo rank observations with named method; separate from Places competitor discovery.
5. `Top competitors`: 5 relevant entities chosen via location/category and reviewed relevance; display **public data source, data date and reason for match**. Do not invent or imply exact competitor SEO traffic.
6. `What WebXXL AI did`: exact drafts created, PRs submitted, approved/published pages and measured outcome. Count drafts separate from published work.
7. `Next opportunities`: prioritized, evidence-referenced SEO actions and expected qualitative rationale; no guaranteed rank or revenue claims.

## 4. Data model and freshness

`SiteAnalyticsConnection`, `SeoSnapshot`, `SitePageInventory`, `CompetitorProfile`, `CompetitorMarket`, `LocalRankObservation`, `SeoOpportunity`, `AgentWorkAssignment` with per-snapshot `siteId`, `marketId?`, `provider`, `propertyId?`, `metricDefinition`, `dateRange`, `observedAt`, `ingestedAt`, `coverage`, `confidence`, `sourceUrl/recordRef`, `status`, `modelVersion`, `query/geo/device` if a rank. Store access scope and lawful provider retention rules. API reflects `NOT_CONNECTED`, `FETCHING`, `READY`, `PARTIAL`, `STALE`, `ERROR`, not dummy zeroes.

## 5. Competitor market methodology

For each site, define business category/services, selected geo center/radius or service area, language and target keywords. Fetch approved places data; dedupe geographic locations/brands, rank candidate competitors by category match, proximity/market overlap and actual relevance; support business owner adjustment. A 'top five competitors' view means **five identified likely local competitors under stated methodology**, not the five highest SEO ranks unless an actual rank provider measures this. For keyword ranking, store queried keyword, coordinates/grid, device, timestamp, engine, observed result/rank and limits. Aggregate ranks by defined method with confidence/coverage and clear 'unavailable' if provider missing.

## 6. AI SEO operations loop

```
Ingest GSC/GA4/GBP/Places/crawl -> normalized dated snapshots
  -> SEO evidence evaluator -> priority queue (impact, effort, risk, confidence)
  -> agent prepares content/technical change with evidence + revision
  -> site project review and risk policy (clinical claims stricter)
  -> GitHub PR / managed-site change / v0 UI handoff as appropriate
  -> immutable preview approval -> deploy via authorized pipeline
  -> update page inventory and compare later measured metrics
```

Do not bulk-generate thin doorway pages or fake neighborhood pages; unique usefulness, factual local knowledge, accessibility and approved patient-facing language mandatory. Legal medical claims require human verification. AI changes should be reversible and attributable.

## 7. Economics and scheduling

Per-site crawling/API cadence tuned to quotas and plan rules (FREE software to customer). Batch GSC pulls, cache snapshots, retry after quotas reset, bill external provider costs to WebXXL unless owner explicitly introduces a chargeable optional third-party product. Implement global fair-use/rate throttling, cost monitoring, incremental refresh and source reconciliation; analytics page loads should **not** trigger new expensive vendor API calls.

## 8. SEO-07 backend implementation (2026-10-18)

Implemented on `main` (SEO-07): Prisma SEO models (`SiteAnalyticsConnection`, `SeoSiteProfile`, crawl/inventory/findings/snapshots/metrics/keywords, competitor market, opportunities, work evidence, provider sync runs); `config/seo-backend.ts` feature flags default **false**; bounded crawler with host allow-list, redirect/body/byte limits, and localhost/private/metadata blocking; GSC Search Analytics adapter with mocked transport, average-position semantics, and no zero-fill for missing rows; account-scoped APIs under `/api/v1/seo/sites/*`; dashboard read model DTO for v0.app; deterministic opportunity rules; AI handoff denies auto-publish without approved `ManagedSiteChange`. Validation: **Prisma validate OK**, **Vitest `seo07-foundation`**, migration **not applied**. **MKT-08** links verified `SeoOpportunity` evidence to `MarketingRequest` + landing-page artifact preparation via `seo-handoff-service.ts` without auto-publish or GitHub PR creation.

## 9. Acceptance

- Two sites in same billing group connect different Google properties and never display each other's data.
- GSC position labelled 'Average position' and date range, not current live rank; no phantom rank grid.
- Competitors show exact method, source and observed timestamp; manually relevant market selection works.
- SEO work panel distinguishes `24 pages discovered`, `3 drafted`, `2 actually published` where those are the true independently verified counts (numbers illustrative).
- When GSC/GA4/GBP unavailable, connected state/error and missing metrics are honest.
- FREE badge/availability and no separate SEO subscription upsell for included core offering.
