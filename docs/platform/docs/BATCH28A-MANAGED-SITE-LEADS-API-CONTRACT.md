# Batch 28A — Managed-site lead intake & CRM qualification API

**Status:** backend V1 (Cursor). **UI owner:** v0.app Lead Inbox (future); **integration:** Cursor (future).  
**Flags:** `SITE_LEAD_INTAKE_ENABLED` (default **OFF**). Customer inbox APIs also require `CRM_BACKEND_ENABLED` and OPEN-001 `core.crm`.  
**Migrations:** `20261031120000_batch28a_managed_site_leads`, `20261031140000_batch28a_2_intake_payload_fingerprint` — in Git only; **not applied** to production by this batch.

## Intake (signed, server-to-server)

`POST /api/v1/site-leads/intake`

Headers:

| Header | Required | Purpose |
|---|---|---|
| `x-webxxl-lead-intake-key` | yes | Public key id (`ManagedSiteLeadIntakeCredential.publicKeyId`) |
| `x-idempotency-key` | yes | Idempotent submission key |
| `x-webxxl-timestamp` | yes | Unix seconds for replay window |
| `x-webxxl-signature` | yes | `HMAC-SHA256` over `{timestamp}.{rawBody}` (same scheme as analytics capture) |

Body (JSON):

- `contactEmail` (required)
- `contactName`, `contactPhone`, `message`, `formReference`, `locale`, `submittedAt` (optional)
- `fields` (optional object)
- `analyticsProvenance` (optional `{ eventId?, captureSessionId? }`) — **provenance only**, not marketing consent
- **Must not** include `customerAccountId` or `managedSiteId`

Success: `{ ok: true, leadId, status, duplicate }` — `201` new, `200` idempotent replay.

**Idempotency (28A.2):** replay after auth requires the same signed `rawBody` as the original submission (stored server-side as SHA-256 `intakePayloadFingerprint`). Same `x-idempotency-key` with a changed body returns **409**. Business duplicate detection uses a separate `submissionFingerprint` (account/site/contact/form) and is independent of the idempotency key.

Secrets resolve from `secretRef` env pointer or `SITE_LEAD_INTAKE_SECRET_{publicKeyId}` — **never** exposed to browser JavaScript.

## Customer inbox (session + CRM permissions)

All require dashboard session, OPEN-001 subscriber eligibility for `core.crm`, and `crm.read` or `crm.write` as noted.

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/api/v1/site-leads` | `crm.read` | Inbox list; filters: `managedSiteId`, `status` (comma-separated), `createdFrom`, `createdTo`, `cursor`, `take`. Cursor is base64url `{createdAt ISO}|{leadId}` aligned with `(createdAt DESC, id DESC)`; foreign/malformed cursors return `VALIDATION`. |
| GET | `/api/v1/site-leads/summary` | `crm.read` | Account-scoped counts `{ summary: { [key]: { value, scope } }, attribution }` |
| GET | `/api/v1/site-leads/[id]` | `crm.read` | Lead detail |
| POST | `/api/v1/site-leads/[id]/pending-review` | `crm.write` | `PENDING_REVIEW` |
| POST | `/api/v1/site-leads/[id]/qualify` | `crm.write` | `QUALIFIED` |
| POST | `/api/v1/site-leads/[id]/reject` | `crm.write` | `REJECTED`; optional body `{ reason }` |
| POST | `/api/v1/site-leads/[id]/convert` | `crm.write` | Idempotent CRM contact create; header `x-idempotency-key` required |

### Lead statuses

`RECEIVED` → `PENDING_REVIEW` → `QUALIFIED` → `CONVERTED`  
Branches: `REJECTED`, `DUPLICATE_REVIEW` (duplicate fingerprint or CRM identity conflict).

Conversion creates `CrmContact` + channel identities + `CrmContactSource` with `sourceSystem: managed_site_lead`. **No** `ContactConsent` rows are created.

### Summary metrics

| Key | Scope | Meaning |
|---|---|---|
| `leadsReceived` | `account_total` | All leads for account (optional site filter) |
| `awaitingReview` | `account_total` | `RECEIVED`, `PENDING_REVIEW`, `DUPLICATE_REVIEW` |
| `qualified` | `account_total` | `QUALIFIED` |
| `converted` | `account_total` | `CONVERTED` |
| `rejected` | `account_total` | `REJECTED` |
| `duplicateReview` | `account_total` | `DUPLICATE_REVIEW` |
| `inboxSample` | `bounded_sample` | Up to inbox sample limit rows (not a full total) |

`attribution.sourceSystem` is always `managed_site_lead` for downstream Analytics / Business Command Center wiring.

## Non-goals (28A)

- No v0 UI, live customer form activation, outbound messaging, or production migration apply.
- WebXXL `SalesLead` intake (`lib/leads/intake.ts`) unchanged; unowned `SalesLead` records are not treated as customer managed-site leads.
