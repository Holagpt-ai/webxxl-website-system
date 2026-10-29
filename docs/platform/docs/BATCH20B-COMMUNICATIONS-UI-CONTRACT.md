# Batch 20B — Unified communications inbox UI contract (v0.app)

**Status:** Backend Batch 20A **MERGED** (PR #61, `1389b328b07a17bd242179816448791477f3dd27`). UI delivered on `v0/communications-ui-20b` @ `efa206760ae076118a9c4c7c4fb7b6a716166f66`; Batch **20C** integrates UI + portal nav on owner-review PR.  
**UI owner:** v0.app (Stage B complete). **Integration owner:** Cursor.

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

Existing consumers that ignore `nextCursor` remain valid. **`400`** `VALIDATION` for bad filter, cursor, malformed/out-of-range `take`, or unavailable inbox. **`404`** not used for list.

List cursor is an opaque anchor on `(lastActivityAt, updatedAt, id)` matching server sort order (not a coalesced timestamp alone).

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

`lastSyncAt` on each inbox is the latest stored `lastSyncAt` from conversation mappings for that inbox (not tenant verification time). When no sync evidence exists, `lastSyncAt` is `null` and `syncStale` is `false`.

Filter chips on inbox list should only offer **verified** inboxes for conversation filters; show pending/revoked rows on connections page with honest labels.

Conversation list `inboxId` / `inbox` query must reference a **verified** inbox with an active verified tenant mapping; otherwise **`400`** `VALIDATION`.

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

Batch **20C** wires dashboard navigation via `lib/portal/modules.ts` (Communications vs project **Messages**).

Inbox list rows with a linked contact id route to **conversation detail** first; CRM contact opens only from detail after server-side account validation.

## Verification (owner)

Authenticated smoke on preview: list filters, cursor pagination, foreign conversation id → 404, disabled comms → 503 panel, EN/ES strings, no overlap with `/dashboard/messages`.
