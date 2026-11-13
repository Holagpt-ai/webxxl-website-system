# Batch 7 — Platform Admin Operations API contract

**Issue:** #109 · **ADR:** not required (composes existing admin queries, execution summaries Batches 4–6, and staff auth).

## Purpose

Unified **staff-only**, **read-only** operations composition across platform queues, runtime gates, and optional per-`CustomerAccount` execution summaries. Does not replace existing `/admin/*` pages or customer portal APIs. Does not activate providers, mutate data, or bypass `CustomerAccount` isolation.

## HTTP

| Method | Path | Auth |
|---|---|---|
| `GET` | `/api/v1/admin/operations/summary` | `requireStaff()` |

### Query parameters

| Param | Required | Behavior |
|---|---|---|
| `customerAccountId` | No | When set, scopes platform queue counts to that account and attaches execution summaries for communications, commerce, marketing, and AI workforce. Account must exist or `accountExecution` is `UNAVAILABLE` / `NOT_FOUND`. |
| `managedSiteId` | No | Requires `customerAccountId`. Verified server-side against `ManagedSite.customerAccountId` before any execution attachment is composed. Mismatch returns **404** `NOT_FOUND`. |

### Success body

```json
{
  "summary": {
    "version": "batch7-platform-admin-operations-v1",
    "scope": "platform | customer_account",
    "customerAccountId": null,
    "platformQueues": { "status": "AVAILABLE", "data": { "...": 0 } },
    "runtimeGates": { "status": "AVAILABLE", "data": { "liveActivationBlocked": true } },
    "accountExecution": { "status": "UNAVAILABLE", "reasonCode": "ACCOUNT_SCOPE_REQUIRED" },
    "publicConversion": { "status": "AVAILABLE", "data": { "state": "DEFERRED_V0" } },
    "unifiedExperience": { "status": "AVAILABLE", "data": { "localeSupport": ["en","es"] } }
  }
}
```

### Platform queues (`platformQueues.data`)

Counts are **operational**, not financial proof: active customers/projects, pending project approvals, open change/support requests, open service orders, website leads awaiting review, blocked/overdue project tasks. When `customerAccountId` is set, counts are filtered to that tenant.

### Account execution attachment

When `customerAccountId` is provided, `accountExecution.data` may include full read-only objects from:

- `GET /api/v1/communications/execution/summary` composition
- `GET /api/v1/commerce/execution/summary` composition
- `GET /api/v1/marketing/execution/summary` composition
- AI workforce execution summary composition

OPEN-001 and module permission gates inside those composers still apply. Staff composition uses a **synthetic read-only context** (`staff_readonly_composition`): the staff user's identity is preserved and **no unrelated `CustomerMembership` row is reused**. `accountExecution.data.staffCompositionKind` is always `staff_readonly_composition`. **Billing groups do not grant sibling CRM or messaging access.**

### Runtime gates

Reports source configuration only (`WORKFLOW_*`, `CUSTOMER_AI_*`, `COMMERCE_CHECKOUT_*`, `COMMS_OUTBOUND_*`). `liveActivationBlocked` is always true in Batch 7.

### Deferred (v0.app)

`publicConversion` and `unifiedExperience.mobilePresentation` are explicitly `DEFERRED_V0`. Cursor does not implement public conversion UI or mobile layout in this batch.

## Errors

| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | Not staff |
| `VALIDATION` | 400 | `managedSiteId` without `customerAccountId` |
| `NOT_FOUND` | 404 | Unknown account site binding for `managedSiteId` |
| `ERROR` | 500 | Unexpected failure |

## v0 Stage B handoff

See [`BATCH7B-ADMIN-UI-INTEGRATION-CONTRACT.md`](BATCH7B-ADMIN-UI-INTEGRATION-CONTRACT.md).
