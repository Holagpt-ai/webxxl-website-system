# BATCH 19B — Local SEO UI integration contract (v0.app)

**Backend batch:** 19A **MERGED** (PR #59 @ `6ff105cf2334a9039d1d57d2dc0a3df878ad1730`).  
**UI batch:** 19B delivered by v0.app @ `59315094ed30d4e80e35b403cbc9def333280a21`; **19C** Cursor integration IN PR.  
**Owner:** v0.app — customer Local SEO screens and copy; Cursor integrates and tests without overlapping backend edits.  
**Do not edit without v0 ownership:** `app/api/**`, `lib/platform/seo/**`, Prisma, workers.

## 1. v0.app-owned paths

| Screen | Route | Files |
|---|---|---|
| SEO overview | `/dashboard/seo` | `app/[locale]/dashboard/seo/page.tsx`, `components/local-seo/**`, `lib/local-seo-ui/**`, `local-seo-workspace-en.ts`, `local-seo-workspace-es.ts` |
| Keywords | `/dashboard/seo/keywords` | same family |
| Opportunities | `/dashboard/seo/opportunities` | same family |
| Pages, local market, connections | existing Batch 16 paths | unchanged scope |

Site selector continues to use `listManagedSitesForAccount` (not only `GET /api/v1/seo/sites`).

## 2. Gates and errors (unchanged from Batch 16)

| Condition | HTTP | Body |
|---|---|---|
| `SEO_BACKEND_ENABLED=false` | 503 | `{ code: "SEO_DISABLED", message }` |
| Entitlement `core.local-seo` unresolved (OPEN-001) | 503 | `{ code: "POLICY_UNRESOLVED", message }` |
| Missing `seo.read` | 403 | permission error |
| Foreign or unknown `siteId` for account | 404 | `{ code: "NOT_FOUND", message }` |
| Invalid query (`take`, filters, cursor) | 400 | `{ code: "VALIDATION", message }` |

English and Spanish UI must label GSC average position using backend `averagePositionLabel` or equivalent copy: **“Average position (Search Console)”** / **“Posición media (Search Console)”**, with helper text that this is not a live fixed rank or map pack position.

## 3. API endpoints (Batch 19A)

All require dashboard session + `seo.read` + active `CustomerAccount` membership. Path param `[siteId]` is the managed site id.

### `GET /api/v1/seo/sites/[siteId]/overview`

Success: `{ overview: SeoSiteOverviewDto }` (existing shape).

**Change (19A):** `overview.sections.gscPerformance` is populated from **stored** GSC observations when a verified GSC connection, matching `SeoSnapshot` window, and compatible rows exist. Fields remain:

- `dataState`, `clicks`, `impressions`, `ctr`, `averagePosition`, `averagePositionLabel`, optional `dateRange`

When evidence is insufficient: keep `null` metrics and honest `dataState` (`NOT_CONNECTED`, `PARTIAL`, etc.). Do not show zero placeholders.

### `GET /api/v1/seo/sites/[siteId]/performance`

Success: `{ gsc: GscPerformanceReadModel, limitations: string[] }`

Aggregate only; same aggregation as overview GSC section. `limitations` explains snapshot/property association constraints.

### `GET /api/v1/seo/sites/[siteId]/keywords` (new)

Query:

| Param | Purpose |
|---|---|
| `take` | 1–100, default 50 |
| `cursor` | Opaque pagination from prior `nextCursor` |
| `q` or `search` | Case-insensitive filter on query or page URL |

Success:

```json
{
  "gsc": { "...": "GscPerformanceReadModel for same window as rows" },
  "keywords": [
    {
      "query": "string",
      "page": "string | null",
      "clicks": "number | null",
      "impressions": "number | null",
      "ctr": "number | null",
      "averagePosition": "number | null",
      "averagePositionLabel": "GSC average position (not fixed rank)",
      "date": "YYYY-MM-DD",
      "dataState": "string",
      "observedAt": "ISO-8601"
    }
  ],
  "limitations": ["string"],
  "nextCursor": "optional opaque string"
}
```

Table UX: show freshness (`observedAt`), observation `date`, and provenance disclaimer from `limitations`. No on-load Google API calls.

### `GET /api/v1/seo/sites/[siteId]/opportunities`

Query: `take` (default 50, max 100), optional `cursor`, optional `state`, `severity`, `confidence` (enum values as stored on `SeoOpportunity`).

Success: `{ opportunities: SeoOpportunity[], nextCursor?: string }`

Ordering: `priorityScore` desc, `id` asc. Display evidence fields (`evidenceRef`, `source`, `observationDate`, `ruleVersion`, `recommendation`, `impactRationale`) without implying guaranteed outcomes.

**Deferred:** accept/dismiss/execute controls — no customer API for state transitions beyond existing stored states.

## 4. Marketing request handoff

Existing flows:

- Dedicated SEO handoff: `createMarketingRequestFromSeoOpportunity` (`lib/platform/marketing/seo-handoff-service.ts`)
- Direct create: `POST /api/v1/marketing/requests` with optional `seoOpportunityId`

**19A validation:** `seoOpportunityId` must belong to the same `CustomerAccount`; when `managedSiteId` is supplied it must match the opportunity’s site. Foreign ids return `404 NOT_FOUND` or `403 FORBIDDEN`.

UI states:

| Marketing API | Meaning for SEO opportunity CTA |
|---|---|
| 503 `MKT_DISABLED` / `NOT_CONFIGURED` | Show disabled handoff; backend flags off |
| 503 `POLICY_UNRESOLVED` | Entitlement unresolved |
| 404 / 403 on opportunity link | Do not retry; show error |
| 201 success | Request created; navigate to Marketing request detail |

Idempotency: reuse existing `idempotencyKey` behavior on create.

## 5. Disconnected / stale / partial UI

Bind to `dataState` on connections, overview sections, and keyword `gsc.dataState`:

| State | Copy intent (EN) |
|---|---|
| `NOT_CONNECTED` | Connect Search Console on Connections screen |
| `PARTIAL` | Some metrics unavailable; explain limitations array |
| `STALE` | Data older than policy; show last observed |
| `ERROR` | Ingestion error; support path |

Spanish mirrors in workspace locale files.

## 6. Verification checklist (v0.app)

- [ ] Overview GSC card uses overview API metrics when non-null; empty state when null
- [ ] Keywords page calls keywords API with pagination and search
- [ ] Opportunities page uses filters + cursor; stable sort matches backend
- [ ] Marketing handoff button respects MKT + SEO gates
- [ ] No fabricated ranks, traffic, or revenue
- [ ] EN/ES strings for GSC average position disclaimer
