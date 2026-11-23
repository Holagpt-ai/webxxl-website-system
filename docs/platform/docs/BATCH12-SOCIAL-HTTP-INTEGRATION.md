# BATCH 12 — Social Marketing HTTP integration

**Status:** IN PR · **Baseline:** Batch 11 branch (`feat/batch11-marketing-artifacts-reviews`) until PR **#148** merges to `main`.

## Scope

Closes Batch 16 §7 social HTTP gaps without live Postiz publishing, OAuth connect, or new migrations.

## Customer routes

| Surface | Method | Path | Notes |
|---|---|---|---|
| Campaign approval submit | POST | `/api/v1/social/campaigns/{id}/approve` | Body `{ "action": "submit" }` → `201` PENDING approval |
| Campaign approval decide | POST | `/api/v1/social/campaigns/{id}/approve` | Body `{ "action": "decide", "approvalId", "decision" }` · OWNER or staff only |
| Approval history | GET | `/api/v1/social/campaigns/{id}/approvals` | Pending / approved / rejected / expired rows |
| Guarded schedule prep | POST | `/api/v1/social/campaigns/{id}/schedule` | `SOCIAL_EXECUTION_GATES_ENABLED` on, live publish off → `202`, intent persisted, dispatch blocked |
| Schedule status | GET | `/api/v1/social/campaigns/{id}/scheduling` | Intent + publication status per campaign |
| Connections + authorization | GET | `/api/v1/social/connections` | Adds `authorization` contract; `oauthConnectEnabled: false` |
| Calendar | GET | `/api/v1/social/calendar` | Invalid `from`/`to` → `400` |
| Artifact → social handoff | POST | `/api/v1/marketing/artifacts/{id}/social-handoff` | `revisionHash` required · `schedulingAllowed: false` |

## Gates (unchanged)

- `SOCIAL_MARKETING_ENABLED` — social routes return `403` when off.
- `POSTIZ_LIVE_PUBLISHING_ENABLED` — schedule route returns `501` when on (owner pilot).
- `SOCIAL_EXECUTION_GATES_ENABLED` — required for guarded schedule persistence; provider-readiness unchanged.
- `MKT_EXTERNAL_HANDOFF_ENABLED` + `MKT_BACKEND_ENABLED` — marketing handoff HTTP.

## Activation boundaries (not Batch 12)

- Postiz live dispatch
- OAuth channel connect HTTP
- Production flag activation
- Batch 10A CRM migration apply

## Tests

`__tests__/platform/batch12-social-http-integration.test.ts` · Batch 34 schedule route expectation updated for `202` persistence.