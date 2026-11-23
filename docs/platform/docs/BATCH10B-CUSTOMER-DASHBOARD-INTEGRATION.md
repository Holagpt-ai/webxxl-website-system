# Batch 10B — Customer dashboard context and module handoffs

**Status:** **MERGED** [PR **#147**](https://github.com/Holagpt-ai/webxxl-website-system/pull/147) @ `b2e2d4a3a93bfead122a41ce5c0194acb2f9de4a`. Flags unchanged.  
**Baseline:** GitHub `main` `b2e2d4a3a93bfead122a41ce5c0194acb2f9de4a` (PR **#146** + **#147**).  
**Date:** 2026-11-23. **Owner:** Cursor. **ADR:** not required — composes existing portal cookies, OPEN-001 gates, and Business Command Center APIs.

## Purpose

Account-scoped dashboard **context** and **module handoffs** across CRM, website projects, Marketing Studio, Local SEO, analytics, communications, commerce/billing, AI employees, and automation — without rebuilding Business Command Center (Batch 27A) or customer-operations (Batch 1).

## HTTP

| Method | Path | Auth |
|---|---|---|
| `GET` | `/api/v1/portal/dashboard-context` | `requireCustomerMembership` |

### Query

| Param | Behavior |
|---|---|
| `customerAccountId` | If present, must equal the session active account; otherwise **403 FORBIDDEN**. |

### Response (abbreviated)

```json
{
  "context": {
    "customerAccountId": "acct_…",
    "generatedAt": "ISO-8601",
    "accountScope": "session_membership",
    "selection": {
      "activeProject": { "id": "…", "name": "…" },
      "activeManagedSite": { "id": "…", "name": "…" }
    },
    "modules": [
      {
        "module": "crm",
        "readiness": { "state": "available", "…" },
        "workspace": { "label": "crm", "path": "/dashboard/crm" },
        "apis": [{ "method": "GET", "path": "/api/v1/crm/contacts" }],
        "siteScoped": false
      }
    ],
    "crossModule": {
      "businessOverview": "/api/v1/business/overview",
      "customerOperations": "/api/v1/customer-operations/summary",
      "siteIntelligence": "/api/v1/site-intelligence/sites/{managedSiteId}/summary",
      "businessCommandCenter": "/dashboard/business",
      "marketingWorkspaces": { "requests": "...", "deliverables": "...", "approvals": "..." },
      "analyticsWorkspaces": { "overview": "...", "traffic": "...", "search": "...", "local": "...", "conversions": "..." },
      "communicationsWorkspaces": { "inbox": "...", "connections": "..." },
      "seoWorkspaces": {
        "overview": "/dashboard/seo",
        "keywords": "/dashboard/seo/keywords",
        "opportunities": "/dashboard/seo/opportunities",
        "pages": "/dashboard/seo/pages",
        "localMarket": "/dashboard/seo/local-market",
        "connections": "/dashboard/seo/connections"
      }
    }
  }
}
```

Template placeholders `{managedSiteId}` and `{customerAccountId}` are filled from `selection` and `customerAccountId`. They are not trusted client input.

### Readiness

Reuses Batch 27A readiness semantics. Disabled backends and unresolved OPEN-001 policy return honest non-`available` states — never zero counts.

## Portal selection cookies

| Cookie | Purpose |
|---|---|
| `webxxl_active_customer_account` | Active `CustomerAccount` (existing) |
| `webxxl_active_project` | Active website project within the account (existing) |
| `webxxl_active_managed_site` | Active managed site for SEO/analytics deep links (**new**) |

`switchCustomerAccountAction` clears project and managed-site cookies, then revalidates all dashboard module layouts. `switchManagedSiteAction` sets the managed-site cookie tenant-scoped.

## Server actions (existing file)

| Action | Change |
|---|---|
| `switchCustomerAccountAction` | Clears stale project/site cookies; broad layout revalidation |
| `switchCustomerProjectAction` | Broad layout revalidation |
| `switchManagedSiteAction` | **New** — account-scoped site selection |

## UI

v0.app / dashboard shell may consume `GET /api/v1/portal/dashboard-context` and `PORTAL_DASHBOARD_API` from `lib/dashboard-ui/types.ts`. Cursor does **not** edit `components/dashboard/**` in this batch. See `docs/BATCH10B-V0-HANDOFF.md`.

## Out of scope

Production migrate, flag enablement, AUTH-STAGING-8C matrix, live sends/charges, rebuilding CRM/Business Center data composers, automation HTTP list APIs (portal routes only).