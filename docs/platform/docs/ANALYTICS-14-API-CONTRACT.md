# ANALYTICS-14 API Contract

Source of truth for the v0.app customer analytics dashboard. All routes require an authenticated customer session (`requireCustomerMembership`) and matching operating account id in the path.

**Base path:** `/api/v1/analytics/accounts/{accountId}`

**Feature gates (default OFF):**

| Gate | Env / config | Effect |
|------|----------------|--------|
| Analytics HTTP | `ANALYTICS_BACKEND_ENABLED` + `features.analyticsBackend` | 503 `ANALYTICS_DISABLED` when off |
| Entitlement | `core.analytics` | 403/503 when disabled or policy unresolved |
| Ingestion worker | `ANALYTICS_INGESTION_ENABLED` | Worker returns 503 when off |
| First-party capture | `ANALYTICS_FIRST_PARTY_CAPTURE_ENABLED` | POST capture API returns 503 when off |
| Provider fetch | `ANALYTICS_PROVIDER_FETCH_ENABLED` + `WORKFLOW_EXTERNAL_EFFECTS_ENABLED` | Live Google fetch remains off by default |
| Provider APIs | `SEO_*` flags in `config/seo-backend.ts` | Connections report `NOT_CONNECTED` / `PENDING` |

**Tenant rules:** Path `accountId` must equal the active customer membership account. Billing-group siblings **cannot** read another account’s metrics (same rule as SEO-07).

**Query parameters (date-bound routes):**

| Param | Required | Description |
|-------|----------|-------------|
| `start` | No | ISO date `YYYY-MM-DD` (UTC). Default: 28 days before `end`. |
| `end` | No | ISO date `YYYY-MM-DD` (UTC). Default: today (UTC). |
| `siteId` | No | Managed site id. Default: oldest site for account. |
| `metric` | Trends only | e.g. `ga4.sessions`, `ga4.activeUsers`. |

Max span: `ANALYTICS_MAX_DATE_RANGE_DAYS` (default 366).

**Timezone:** Responses include `timezone` (default `UTC`). Provider timestamps are returned as ISO-8601; no implicit local conversion.

---

## GET `/overview`

Unified BI summary: traffic, search, local, conversions, acquisition, CRM counts, sync freshness.

**Response:** `AnalyticsOverviewDto` — see `lib/platform/analytics/dto.ts`.

**Data sources:** Reuses SEO-07 storage (`SiteAnalyticsConnection`, `SeoMetricObservation`, `SeoKeywordObservation`, `LocalRankObservation`, `SeoProviderSyncRun`) plus BATCH-14 conversion tables. **No fabricated metrics** when disconnected.

---

## GET `/properties`

Authorized property connections per managed site (from `SiteAnalyticsConnection`).

**Response:** `AnalyticsPropertyConnectionDto[]`

---

## GET `/traffic`

Traffic series and period-over-period session change.

**Response:** `{ dataState, series[], periodChanges[] }`

---

## GET `/search`

Search Console performance (clicks, impressions, CTR, average position).

**Response:** `AnalyticsSearchPerformanceDto` — average position labeled as GSC average (not fixed rank).

---

## GET `/local`

Google Business Profile metrics (when ingested) and local rank observation count.

**Response:** `AnalyticsLocalPerformanceDto`

---

## GET `/conversions`

Summarized conversion counts and rates (rate null when sessions unknown).

**Response:** `AnalyticsConversionSummaryRowDto[]`

---

## GET `/trends?metric=ga4.sessions`

Historical trend points for a single GA4 metric definition.

**Response:** `AnalyticsTrendSeriesDto`

---

## GET `/sync-status`

Recent `SeoProviderSyncRun` rows and ingestion flag state.

**Response:** `AnalyticsSyncStatusDto`

---

## POST `/api/v1/analytics/sync/worker`

Internal ingestion entry point. **503** unless `ANALYTICS_INGESTION_ENABLED=true`. Processes bounded sync intents for connected sites; live provider HTTP requires `ANALYTICS_PROVIDER_FETCH_ENABLED` and `WORKFLOW_EXTERNAL_EFFECTS_ENABLED` (both default off).

---

## POST `/api/v1/analytics/capture/events`

Site-bound first-party conversion capture (customer websites). **503** unless `ANALYTICS_FIRST_PARTY_CAPTURE_ENABLED=true`.

**Headers:** `X-Webxxl-Capture-Key` (public key id), `X-Webxxl-Timestamp`, `X-Webxxl-Signature` (`sha256=` HMAC of `{timestamp}.{rawBody}`), optional `X-Idempotency-Key`.

**Body:** `{ eventKey, occurredAt?, consentGranted: true, consentVersion?, sessionRef?, visitorRef?, pagePath?, customConversionKey?, metadata? }`

Approved classes: `form_submit`, `contact_request`, `appointment_request`, `qualified_lead`, or `custom_conversion` with `customConversionKey` matching an active `AnalyticsConversionDefinition`.

No PHI, medical form content, email, phone, or free-text message bodies. Rate limited per capture key.

**Response:** `{ ok, eventId, duplicate }` with **201** on first persist, **200** on idempotent replay.

---

## Error envelope

```json
{ "code": "ANALYTICS_DISABLED | UNAUTHORIZED | FORBIDDEN | TENANT_MISMATCH | VALIDATION | NOT_FOUND | ...", "message": "..." }
```

**Status codes:** 401 unauthorized session; 403 forbidden / tenant mismatch; 400 validation; 404 site not found; 503 disabled or provider unavailable.

---

## Prisma (BATCH-14 additive)

- `AnalyticsConversionDefinition`
- `AnalyticsConversionObservation`
- `WebxxlConversionEvent`
- Enum extension: `SeoAnalyticsProvider.WEBXXL_EVENTS`

## Prisma (BATCH-15 additive)

- `AnalyticsSiteCaptureCredential` (site-bound public key + secret hash/ref; never store raw secret)
- `AnalyticsConversionObservation.uniqueCount`
- Consent and provenance columns on `WebxxlConversionEvent`

Migration: `20261025120000_analytics15_ingestion` (not applied in production unless separately authorized).

Provider connection and metric time series remain on SEO-07 models to avoid duplicate ingestion.

AUTO-10 job kinds: `ANALYTICS_PROVIDER_SYNC`, `ANALYTICS_CONVERSION_AGGREGATE`.

---

## CRM relationship disclaimer

CRM block counts `SalesLead` and open `CrmDeal` rows for the **same customer account only**. Copy explicitly disclaims marketing attribution and revenue impact.
