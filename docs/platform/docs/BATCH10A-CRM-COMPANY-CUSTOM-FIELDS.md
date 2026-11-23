# Batch 10A — CRM company records, custom fields, and suppression lift

**Status:** **MERGED** [PR **#146**](https://github.com/Holagpt-ai/webxxl-website-system/pull/146) @ `142395b51f54a62d93a70e23d1a16eb3b62e8db0`. Flags unchanged. Migration in Git only — **do not apply** without owner authorization.  
**Baseline:** GitHub `main` `142395b51f54a62d93a70e23d1a16eb3b62e8db0`.  
**Date:** 2026-11-23. **Owner:** Cursor. **ADR:** not required. Applies existing CRM-05 / OPEN-001 / tenant isolation. Does not change POLICY-SUB-001.

This batch implements the remaining CRM HTTP gaps named in [`BATCH16-CUSTOMER-BUSINESS-WORKSPACE-CONTRACT.md`](BATCH16-CUSTOMER-BUSINESS-WORKSPACE-CONTRACT.md) §7 and [`BATCH17B-CRM-UI-INTEGRATION-CONTRACT.md`](BATCH17B-CRM-UI-INTEGRATION-CONTRACT.md) (deferred): company detail, custom fields, and suppression lift/deactivate. It does **not** rebuild contacts, pipelines, tasks, import/export, or OPEN-001 gates.

## Invariants

- `CustomerAccount` is the operational tenant. `BillingGroup` never grants sibling CRM reads or writes.
- OPEN-001 `requireCrmApiActor` still gates every route (`CRM_BACKEND_ENABLED` + subscriber evidence + permission).
- Custom fields are account-owned JSON scalars. Nested objects/arrays are rejected.
- Lifting suppression deactivates an existing `ContactSuppression` row. It **does not** grant consent, clear consent history, or authorize outbound send.
- Import/CSV sources cannot lift suppression.

## HTTP

Session-scoped `CustomerAccount`. Permission via `requireCrmApiActor`.

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/api/v1/crm/companies/[id]` | `crm.read` | Account-scoped company + linked contacts + recent deals |
| PATCH | `/api/v1/crm/companies/[id]` | `crm.write` | Name, website, industry, phone, email, `customFields` |
| POST | `/api/v1/crm/companies` | `crm.write` | Existing create; now accepts phone, email, `customFields` |
| POST | `/api/v1/crm/companies/[id]/contacts` | `crm.write` | Link contact in the same account; idempotent |
| DELETE | `/api/v1/crm/companies/[id]/contacts/[contactId]` | `crm.write` | Unlink only; does not delete the contact |
| PATCH | `/api/v1/crm/contacts/[id]` | `crm.write` | Existing patch; now accepts `customFields` |
| POST | `/api/v1/crm/contacts/[id]/suppression/lift` | `crm.consent.manage` | Deactivate suppression; `consentUnchanged: true` |

### Suppression lift body

`{ suppressionId }` **or** `{ channel, purpose }`, plus required `{ reason, source }`, optional `idempotencyKey`.

| Result | Meaning |
|---|---|
| 200 `{ id, alreadyLifted, consentUnchanged: true }` | Lift applied or replayed |
| 403 `FORBIDDEN` | Member role, or `source` is `crm.import` / `import.csv` |
| 404 `NOT_FOUND` | Contact or suppression not in this account |

## Custom fields

Object of at most 40 keys. Keys match `^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$`. Values are string (≤2048), finite number, boolean, or null. `null` as the whole field clears stored JSON.

## Migration

`prisma/migrations/20261123120000_batch10a_crm_company_suppression_lift` adds lift audit columns on `ContactSuppression`. **Not applied** in this batch. Production remains **40/40** until a separate owner-authorized migrate.

## UI

v0.app owns CRM screens. This batch does not edit `components/crm/**` or `lib/crm-ui/**`. Wire company detail, custom fields, and lift actions in a later v0 handoff.

## Out of scope

Live Twenty sync, reminders/workers, messaging send, POLICY-SUB-001, AUTH-STAGING-8C browser QA, production migrate, flag enablement.
