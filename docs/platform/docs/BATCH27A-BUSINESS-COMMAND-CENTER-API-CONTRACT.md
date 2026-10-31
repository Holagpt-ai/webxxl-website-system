# Batch 27A — Business Command Center API contract

**Status:** backend V1 (read-only). **UI owner:** v0.app Batch 27B. **Integration owner:** Cursor Batch 27C (future).  
**Baseline:** GitHub `main` after PR #71. **ADR:** not required — aggregates existing module data; no new workflow engine.

## Purpose

One authenticated, account-scoped overview for CRM, Marketing Studio, Local SEO, communications, and website-project workflows. The API **does not** replace `/dashboard` website preview, milestone ETA, project dependency UI, or global approvals pages — it **summarizes** cross-module actions for a future Business Command Center screen.

## HTTP

| Method | Path | Auth |
|---|---|---|
| `GET` | `/api/v1/business/overview` | Customer dashboard session (`requireCustomerMembership`) |

### Query parameters

| Param | Required | Behavior |
|---|---|---|
| `customerAccountId` | No | If present, must equal the session active account. Otherwise `403 FORBIDDEN`. **Never** trust a client account id for authorization. |

### Account switching

Uses the same active-account cookie as other customer portal APIs (`pickActiveMembership` in `lib/portal/authz.ts`). Switching accounts in the dashboard shell changes subsequent overview responses. There is no cross-account overview.

### Success body

```json
{
  "overview": {
    "customerAccountId": "acct_…",
    "generatedAt": "2026-10-31T12:00:00.000Z",
    "accountScope": "session_membership",
    "modules": [ … ],
    "actions": [ … ],
    "limits": {
      "maxActionsReturned": 40,
      "maxActionsPerModule": 12
    }
  }
}
```

### Module snapshot (`modules[]`)

| Field | Type | Notes |
|---|---|---|
| `module` | `"crm" \| "marketing" \| "local_seo" \| "communications" \| "website_projects"` | Stable module key for UI tabs |
| `readiness` | object | See readiness states below |
| `summary` | object (optional) | Numeric counts **only** when `readiness.state === "available"` |

#### Readiness states (honest availability)

| `state` | Meaning | UI must |
|---|---|---|
| `available` | Module gates passed; queries ran. Check `empty` and `evidenceCount`. | Show counts/actions or empty state |
| `disabled` | Backend kill switch off (e.g. `CRM_DISABLED`). | Show disabled module — **not** zero activity |
| `not_configured` | Entitlement/policy disabled in environment | Show not configured |
| `policy_unresolved` | OPEN-001 policy unresolved | Show policy banner |
| `not_eligible` | Subscriber evidence does not grant included software | Show eligibility message |
| `unauthorized` | Membership lacks module read permission | Show permission message |
| `unavailable` | Data store unavailable (e.g. migration not applied) | Show unavailable — **not** zero |

When `state` is not `available`, omit `summary` and do not show module action counts as zero.

### Action item (`actions[]`)

Normalized, read-only prioritization. **No mutations** are performed by this API.

| Field | Type | Notes |
|---|---|---|
| `module` | module key | Source module |
| `actionType` | stable string | e.g. `crm.task.overdue`, `marketing.review.pending` — use for i18n keys in 27B |
| `recordRef` | `{ kind, id }` | Stable record reference for deep links |
| `priority` | `"high" \| "medium" \| "normal" \| "low"` | From due dates / existing scores only |
| `title` | string | From source record (not invented) |
| `destination` | `{ path }` | Locale-neutral path; prefix `/es` for Spanish |
| `timestamp` | ISO-8601 | Primary evidence time |
| `dueAt` | ISO-8601 or null | When applicable |
| `customerAccountId` | string | Always the session account |

Actions are sorted by priority then timestamp, capped by `limits`.

### Module evidence sources (reuse only)

| Module | Existing sources |
|---|---|
| CRM | `CrmTask`, `CrmDeal`, `listMergeProposals` |
| Marketing | `MarketingRequest`, `listMarketingReviews`, `listMarketingArtifacts` |
| Local SEO | `SeoOpportunity` (actionable states) |
| Communications | `listAccountInboxes`, `listAccountConversations` (`needs_attention`) |
| Website projects | `ProjectApproval`, `ProjectDependency` (account-wide; not a duplicate Action Center) |

### Errors

| Status | `code` | When |
|---|---|---|
| 401 | `UNAUTHORIZED` | No session |
| 403 | `FORBIDDEN` | Mismatched `customerAccountId` query |
| 500 | `ERROR` | Unexpected failure |

Module-specific gate codes appear only inside `modules[].readiness`, not as top-level HTTP errors.

### Bilingual UI (27B)

API returns stable `actionType` keys and locale-neutral `destination.path`. Customer-facing labels and locale prefixes are owned by v0.app dictionaries (English/Spanish).

### Explicit non-goals (27A)

- No UI routes or components
- No production migrations or flag activation
- No outbound sends, provider sync, or task creation
- No BillingGroup sibling data access
