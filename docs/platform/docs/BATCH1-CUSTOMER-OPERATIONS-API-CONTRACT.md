# Batch 1 — Customer Operations Engine API contract

**Status:** backend integration on owner-review branch (Issue **#111**). Composes existing Business Command Center, managed-site lead pipeline, CRM lineage, and project lifecycle context. **No new CRM or intake architecture.**

## `GET /api/v1/customer-operations/summary`

- **Auth:** customer session membership (`requireCustomerMembership`). Optional `customerAccountId` query must match the session account or returns **403**.
- **Scope:** read-only aggregation; does not mutate leads, CRM, or projects.
- **Entitlement:** reuses Batch 27A / OPEN-001 CRM module access for the lead pipeline and lineage section. `businessOverview` embeds the full `GET /api/v1/business/overview` payload.

### Response shape (abbreviated)

```json
{
  "summary": {
    "customerAccountId": "…",
    "generatedAt": "ISO-8601",
    "accountScope": "session_membership",
    "businessOverview": { "…": "same as /api/v1/business/overview" },
    "leadPipeline": {
      "readiness": { "state": "available|disabled|not_eligible|…" },
      "summary": { "leadsReceived": { "value": 0, "scope": "account_total" } }
    },
    "recentLineage": [
      {
        "leadId": "…",
        "status": "QUALIFIED",
        "managedSiteId": "…",
        "crm": { "contactId": "…", "openDeals": 0, "openTasks": 1, "destination": { "path": "…" } },
        "project": {
          "projectId": "…",
          "pendingApprovals": 0,
          "openDependencies": 1,
          "nextMilestoneTitle": "…"
        }
      }
    ],
    "navigation": {
      "businessCommandCenter": "/dashboard/business",
      "crmLeads": "/dashboard/crm/leads",
      "crmFunnel": "/dashboard/crm/leads/funnel",
      "projectDashboard": "/dashboard/project"
    }
  }
}
```

### Lineage rules

- Up to **8** recent managed-site leads per account (`CUSTOMER_OPERATIONS_MAX_LINEAGE`).
- `crm` appears only when `crmContactId` is set (post-conversion or linked contact).
- `project` resolves via `ManagedSite.projectId` when present; milestone/deps/approval counts are **account-scoped** reads only.
- Destinations are locale-neutral dashboard paths (v0 prefixes `/es` when needed).

### v0 UI handoff (not in this batch)

Optional future work: consume this endpoint from `/dashboard/business` or a dedicated operations panel. **Files (v0-owned):** `app/[locale]/dashboard/business/**`, `components/business/**`. Cursor does not edit those paths in Batch 1.

### Release gates

Merged source ≠ production migration, flag activation, or browser QA. Broad CRM E2E remains Batch 8 / Issue #109 build-first policy.
