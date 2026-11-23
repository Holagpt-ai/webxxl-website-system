# Batch 11 — Marketing Studio account-wide lists & approval handoffs

**Status:** source integration (owner-review PR). **ADR:** not required — extends Batch 18A list APIs with dashboard handoffs and continuity reconciliation.  
**Baseline:** GitHub `main` `b2e2d4a3a93bfead122a41ce5c0194acb2f9de4a` (PR **#147** MERGED Batch 10B; PR **#146** MERGED Batch 10A).  
**Flags:** unchanged (`MKT_BACKEND_ENABLED` default off). **No** production migrate, Postiz publish, or live sends.

## Purpose

Close Batch 16 §7 gaps for **account-wide deliverable listing** and **approval inbox listing** by documenting, hardening, and wiring the existing Batch 18A HTTP surface into Batch 10B dashboard-context handoffs. Does **not** duplicate Batch 18A list/query logic or v0 Marketing Studio UI.

## HTTP (session `CustomerAccount` only)

| Method | Path | Permission | Notes |
|---|---|---|---|
| `GET` | `/api/v1/marketing/artifacts` | `marketing.read` | Cursor pagination; filters: `managedSiteId`, `marketingRequestId`/`requestId`, `artifactType`, `reviewStatus` |
| `GET` | `/api/v1/marketing/reviews` | `marketing.read` | Cursor pagination; filters + `status` effective bucket |
| `GET` | `/api/v1/marketing/reviews/[id]` | `marketing.read` | Review detail + `allowedActions` |
| `POST` | `/api/v1/marketing/reviews/[id]/decide` | `marketing.artifact.review` | Existing approval workflow (unchanged) |

### List response additions (Batch 11)

Each list row includes **`destination.path`** (locale-neutral dashboard deep link). Success bodies include static **`navigation`** workspaces:

```json
{
  "artifacts": [{ "id": "…", "destination": { "path": "/dashboard/marketing/deliverables/…" }, "…": "…" }],
  "nextCursor": "optional",
  "navigation": {
    "requests": "/dashboard/marketing/requests",
    "deliverables": "/dashboard/marketing/deliverables",
    "approvals": "/dashboard/marketing/approvals"
  }
}
```

Reviews mirror the same `navigation` object; each review `destination.path` links to the deliverable detail with `reviewId`.

### Tenant scope

Optional filters (`managedSiteId`, `requestId`, `artifactId`) are validated with `validateMarketingListScope` — unknown ids for the session account return **`400` `VALIDATION`**, never sibling-account data.

## Dashboard context (Batch 10B extension)

`GET /api/v1/portal/dashboard-context` adds **`crossModule.marketingWorkspaces`** and lists marketing list/detail APIs under the `marketing_studio` module handoff.

## UI (v0.app)

See [`docs/BATCH11-V0-HANDOFF.md`](../../BATCH11-V0-HANDOFF.md). Cursor does **not** edit `components/marketing-studio/**`.

## Out of scope

Social HTTP handoff/approve, live schedule, Postiz OAuth, production migrations, flag enablement, browser QA matrix.