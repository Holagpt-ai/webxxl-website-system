# Batch 30A — Managed-site lead funnel reporting & Business Command Center integration

**Status:** read-only backend (Cursor). **UI:** deferred to Batch 30B (v0.app).  
**Flags:** Reporting does **not** require `SITE_LEAD_INTAKE_ENABLED`; requires `CRM_BACKEND_ENABLED`, OPEN-001 `core.crm`, and `crm.read`.  
**Migrations:** Uses `ManagedSiteLead` tables from Batch 28A — in Git only until owner-applied.

## Purpose

Account-scoped funnel intelligence from authoritative `ManagedSiteLead` records: counts, trends, source attribution coverage, and CRM module wiring in `GET /api/v1/business/overview`. No new analytics engine; no inferred ROI or campaign conversions.

## Reporting API

`GET /api/v1/site-leads/funnel-report`

### Authorization

- Dashboard session via `requireSiteLeadReportingActor` (same OPEN-001 + CRM permission stack as inbox, **without** live intake activation).
- Tenant scope: session `CustomerAccount` only. No cross-account or BillingGroup sibling access.

### Query parameters

| Param | Required | Description |
|---|---|---|
| `createdFrom` | no | ISO date (default: 30 days before `createdTo`) |
| `createdTo` | no | ISO date inclusive (default: today UTC) |
| `managedSiteId` | no | Filter to one managed site (must belong to account) |
| `formReference` | no | Filter to one form reference string |

Max range: `SITE_LEAD_FUNNEL_MAX_RANGE_DAYS` (default 366).

### Response `{ report }`

| Section | Meaning |
|---|---|
| `summary.*` | Cohort metrics for leads **created** in the date range, by **current** lifecycle status |
| `conversionsInPeriod` | Leads with `convertedAt` in range (CRM contact created — **not** a sale) |
| `qualifiedEventsInPeriod` | Leads with `qualifiedAt` in range |
| `rejectedEventsInPeriod` | Leads with `rejectedAt` in range |
| `byManagedSite` / `byFormReference` | Bounded breakdown rows (max 50 groups) |
| `creationTrend` | Daily `leadsCreated` counts in range |
| `attribution` | Coverage of stored provenance only; `analyticsEventLinkedLeads` when `analyticsEventRef` is set |
| `semantics` | Human-readable count definitions (stable keys in `attribution.labelKeys` for EN/ES UI) |

### Errors

| Code | HTTP | When |
|---|---|---|
| `VALIDATION` | 400 | Bad dates or range too wide |
| `FORBIDDEN` | 403 | Site filter outside account |
| `CRM_DISABLED` | 503 | CRM backend off |
| `NOT_CONFIGURED` | 503 | Lead tables missing (migration not applied) |
| OPEN-001 / permission codes | 401/403/503 | Same as other CRM APIs |

## Business Command Center (CRM module)

`GET /api/v1/business/overview` adds to the **existing CRM module**:

- Summary keys: `websiteLeadsReceived`, `websiteLeadsAwaitingReview`, `websiteLeadsQualified`, `websiteLeadsConverted`, `websiteLeadsDuplicateReview` (`account_total` only).
- `websiteLeadReporting.readiness` — independent from core CRM readiness (lead tables missing or source errors do **not** disable tasks/deals).
- Actions: `crm.website_lead.awaiting_review`, `crm.website_lead.duplicate_review` → `/dashboard/crm/leads` (Lead Inbox). `recordRef.id` carries the lead id for future UI selection (30A.1).

## Non-goals (30A)

- No v0 UI, outbound messaging, production migrations, flag activation, or customer site wiring.
- No automatic correlation between GA4/GBP and CRM leads beyond stored `analyticsEventRef`.
