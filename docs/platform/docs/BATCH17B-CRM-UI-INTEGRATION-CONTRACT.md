# Batch 17B — CRM UI integration contract (v0.app)

**Status:** UI delivered on branch `v0/crm-ui-17b` @ `b1b4270294406a4f8f9dc00655f6b1f37e734f17`; integrated via Batch 17C owner-review PR. Backend Batch 17A is merged on `main` (`2ef9a90`, PR #55).  
**Baseline:** GitHub `main` after Batch 17A merge. **UI owner:** v0.app (Stage B complete). **Backend owner:** Cursor (frozen for Stage B).

Do not call these routes when CRM returns `503` `CRM_DISABLED` or `POLICY_UNRESOLVED`. Render the same unavailable states as Batch 16.

## Scope (v0.app-owned files only)

| Path | Change |
|---|---|
| `app/[locale]/dashboard/crm/contacts/page.tsx` | Search input, pagination using `q` + `cursor` |
| `app/[locale]/dashboard/crm/contacts/[contactId]/page.tsx` | Consent/suppression panel (read); link to settings for owners |
| `app/[locale]/dashboard/crm/pipeline/page.tsx` | Stage change control per deal |
| `app/[locale]/dashboard/crm/tasks/page.tsx` | Task status, completion, due date edits |
| `components/crm/contacts.tsx`, `contact-detail.tsx`, `pipeline.tsx`, `tasks.tsx` | Wire controls; no backend edits |
| `lib/crm-ui/**` | Client fetch helpers and types only |

English and Spanish copy stays in `lib/i18n/dictionaries/crm-workspace-*.ts`. Shared portal dictionaries unchanged unless new nav labels are required.

## Extended / new HTTP contracts

All routes use session-derived `CustomerAccount`. No `customerAccountId` in request bodies.

### Contact search and pagination

**`GET /api/v1/crm/contacts`** — `crm.read`

| Query | Meaning |
|---|---|
| `take` | Optional page size (1–100, default 50) |
| `q` or `search` | Optional bounded search string (max 120 chars) |
| `cursor` | Optional opaque cursor from prior `nextCursor` |

**200**

```json
{
  "contacts": [ "…CrmContact with channelIdentities…" ],
  "nextCursor": "optional-opaque-string"
}
```

When no further page exists, omit `nextCursor`. Existing consumers that ignore `nextCursor` remain valid.

Errors: `400` `VALIDATION_ERROR` (bad cursor), `403`/`503` gates unchanged.

### Deal stage move

**`PATCH /api/v1/crm/deals/[id]/stage`** — `crm.write`

**Body:** `{ "stageId": "…" }` (alias `toStageId` accepted)

**200:** `{ "deal": …CrmDeal… }`  
**404:** deal or stage not in account pipeline  
**400:** missing `stageId`  
No-op when stage unchanged (200, no duplicate history row).

### Task update

**`PATCH /api/v1/crm/tasks/[id]`** — `crm.write`

**Body (all optional):** `title`, `status` (`OPEN` | `IN_PROGRESS` | `COMPLETED` | `CANCELLED`), `priority`, `dueAt` (ISO or `null`), `disposition`, `assignedUserId` (owner/staff only)

**200:** `{ "task": …CrmTask… }`  
**403:** member attempted assignee change  
**400:** invalid transition or empty title

Completing sets `completedAt` once; terminal tasks cannot reopen.

### Consent and suppression

**`GET /api/v1/crm/contacts/[id]/consent`** — `crm.read`

**200:** `{ "consents": ContactConsent[] (with evidence), "suppressions": ContactSuppression[] }`  
**404:** contact not in account

**`POST /api/v1/crm/contacts/[id]/consent`** — `crm.consent.manage` (owner/staff)

**Body:** `channel`, `purpose`, `status`, `source`, `capturedAt` (ISO), optional `termsVersion`, `idempotencyKey`, `evidence[]` with `evidenceRef` (+ optional `detail`)

**201:** `{ "id": "…" }`  
**400:** `GRANTED` without evidence; import-like `source` rejected

**`POST /api/v1/crm/contacts/[id]/suppression`** — `crm.consent.manage`

**Body:** `channel`, `purpose`, `reason`, `source`, optional `idempotencyKey`

**201:** `{ "id": "…" }`

New consent does **not** clear active suppression. No outbound send/connect UI.

## Permission matrix (UI)

| Action | Member | Owner | Staff |
|---|---|---|---|
| Search/read contacts | yes | yes | yes |
| Move deal stage | yes | yes | yes |
| Update task (no assignee) | yes | yes | yes |
| Change task assignee | no | yes | yes |
| View consent history | yes | yes | yes |
| Record consent/suppression | no | yes | yes |

## Disabled and error states

- Keep Batch 16 patterns for `CRM_DISABLED`, `POLICY_UNRESOLVED`, non-JSON failures.
- Empty search: show empty list, not an error.
- Stale cursor: show recoverable error; reset to first page.
- Consent write denied for members: hide primary actions; show read-only history.

## Deferred (not 17B)

- Custom fields, company detail HTTP, suppression lift/deactivate API, live messaging, reminders, workers.
