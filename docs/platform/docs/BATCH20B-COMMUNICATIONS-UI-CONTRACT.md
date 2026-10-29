# Batch 20B — Unified communications inbox UI contract (v0.app)

**Status:** Backend Batch 20A read APIs on owner-review PR; **UI not started**.  
**Baseline:** GitHub `main` after Batch 19B+19C merge (`8b7cd4daf84ccd5f8ad3bd5af98fd8fb7b4b356e`, PR #60).  
**UI owner:** v0.app. **Backend owner:** Cursor (frozen for Stage B).

Reserved customer routes (create in Batch 20B only; **do not** edit `/dashboard/messages` or shared dashboard nav in 20A):

| Route | Purpose |
|---|---|
| `/dashboard/communications` | Unified conversations inbox |
| `/dashboard/communications/conversations/[id]` | Conversation detail (metadata; no fabricated transcript) |
| `/dashboard/communications/connections` | Chatwoot connection and inbox visibility |

English unprefixed and Spanish `/es/dashboard/...` via `app/[locale]/dashboard/`. Copy in new `lib/i18n/dictionaries/comms-workspace-en.ts` and `comms-workspace-es.ts`.

## Distinction from project messages

- **`/dashboard/messages`:** existing project-scoped messaging (unchanged).
- **`/dashboard/communications`:** customer business omnichannel inbox (Chatwoot-backed mappings, CRM-linked contacts). UI must label this clearly in EN/ES.

## Gates and unavailable states

Call APIs only when session has an operating `CustomerAccount`. When responses are **`503`** with `COMMS_DISABLED` or `POLICY_UNRESOLVED` (OPEN-001), render the same pattern as CRM/Marketing disabled panels — no retry loops, no provider OAuth buttons in 20B.

## Permission matrix

| Action | Member | Owner | Staff |
|---|---|---|---|
| List/read conversations | yes | yes | yes |
| Read connections/inboxes | yes | yes | yes |
| Open linked CRM contact (read) | yes | yes | yes |
| Send message / connect provider | **no** | **no** | **no** |

All routes use session-derived account scope; never send `customerAccountId` in query or body.

---

### `GET /api/v1/communications/conversations` — `comms.read`

| Query | Meaning |
|---|---|
| `take` | Page size 1–100 (default 50) |
| `filter` | Optional: `open`, `pending`, `resolved`, `assigned`, `assigned_to_me`, `unassigned`, `needs_attention` |
| `inboxId` or `inbox` | Optional verified inbox mapping id or external inbox id for account |
| `channel` | Optional channel string (max 64 chars) |
| `cursor` | Opaque cursor from prior `nextCursor` |

**200**

```json
{
  "conversations": [
    {
      "id": "mapping cuid",
      "externalConversationId": "provider id",
      "externalInboxId": "provider inbox id",
      "webxxlStatus": "OPEN | PENDING | RESOLVED",
      "channel": "web | sms | …",
      "crmContactId": "uuid | null",
      "lastActivityAt": "ISO | null",
      "lastSyncAt": "ISO | null",
      "syncStale": true,
      "coverageState": "UNKNOWN | PARTIAL | …",
      "needsAttention": false
    }
  ],
  "nextCursor": "optional-opaque-string"
}
```

Existing consumers that ignore `nextCursor` remain valid. **`400`** `VALIDATION` for bad filter, cursor, or unknown inbox. **`404`** not used for list.

Empty inbox: `{ "conversations": [] }` with helpful EN/ES empty state (not configured vs no conversations).

---

### `GET /api/v1/communications/conversations/[id]` — `comms.read`

**200**

```json
{
  "conversation": {
    "...ConversationSummary fields",
    "assignedUserRef": "string | null",
    "priority": "NORMAL | …",
    "syncError": "string | null",
    "inboxMappingId": "uuid | null",
    "crmContact": { "id": "uuid", "displayName": "string | null" } | null,
    "crmTimelinePath": "/api/v1/crm/contacts/{id}/timeline | null",
    "tenantVerificationState": "PENDING | VERIFIED | …",
    "providerConnected": false,
    "transcriptAvailable": false,
    "transcriptNote": "string explaining metadata-only read"
  }
}
```

**404** when id not in account. Do **not** render a chat transcript UI unless a future gated API sets `transcriptAvailable: true`. Link to CRM contact detail when `crmContact` is present.

---

### `GET /api/v1/communications/inboxes` — `comms.read`

**200**

```json
{
  "inboxes": [
    {
      "id": "uuid",
      "externalInboxId": "provider id",
      "channelType": "string | null",
      "verificationState": "PENDING | VERIFIED | …",
      "tenantVerificationState": "…",
      "tenantRevoked": false,
      "visibilityState": "NOT_CONFIGURED | MAPPING_PENDING | VERIFIED | DISCONNECTED | STALE_SYNC",
      "lastSyncAt": "ISO | null",
      "syncStale": true
    }
  ]
}
```

Filter chips on inbox list should only offer **verified** inboxes for conversation filters; show pending/revoked rows on connections page with honest labels.

---

### `GET /api/v1/communications/connections` — `comms.read`

**200**

```json
{
  "chatwoot": {
    "configured": false,
    "verificationState": "optional",
    "authorizedInboxCount": 0,
    "verifiedInboxCount": 0,
    "disconnected": true,
    "mappingPending": false,
    "staleSyncRisk": false,
    "dataState": "NOT_CONNECTED | PARTIAL | READY | DISCONNECTED",
    "summary": "human-readable status"
  },
  "outbound": {
    "enabled": false,
    "dataState": "DISABLED | ENABLED"
  }
}
```

No install, OAuth, credential, or webhook controls in 20B UI.

---

## CRM navigation

When `crmContact` is present, deep-link to `/dashboard/crm/contacts/[contactId]`. Timeline enrichment uses **`GET /api/v1/crm/contacts/{id}/timeline`** (existing CRM contract). Do not infer marketing consent from inbound threads.

## v0.app file ownership (Batch 20B)

| Path | Change |
|---|---|
| `app/[locale]/dashboard/communications/**` | New pages (3 routes above) |
| `components/communications/**` | Inbox table, filters, detail header, connection cards |
| `lib/comms-ui/**` | Fetch helpers, types, cursor recovery |

Cursor will wire dashboard navigation **after** v0 handoff (not in 20A).

## Verification (owner)

Authenticated smoke on preview: list filters, cursor pagination, foreign conversation id → 404, disabled comms → 503 panel, EN/ES strings, no overlap with `/dashboard/messages`.
