# v0 — Batch 12 Social Marketing HTTP (presentation only)

Backend delivered on Cursor-owned paths. Do **not** edit `app/api/**` or `lib/platform/**`.

## Wire these APIs in Marketing Studio

| UX | API |
|---|---|
| Submit campaign for approval | `POST /api/v1/social/campaigns/{id}/approve` `{ "action": "submit" }` |
| Owner approve / reject | Same route `{ "action": "decide", "approvalId", "decision": "APPROVED" \| "REJECTED" }` |
| Approval timeline | `GET /api/v1/social/campaigns/{id}/approvals` |
| Request schedule (no publish) | `POST /api/v1/social/campaigns/{id}/schedule` — expect `202`, `intentPersisted: true`, dispatch blocked message |
| Schedule status list | `GET /api/v1/social/campaigns/{id}/scheduling` |
| Connections + auth states | `GET /api/v1/social/connections` → `authorization.rows[].authorizationState` |
| Provider readiness | `GET /api/v1/social/provider-readiness` (unchanged) |
| Approved artifact handoff | `POST /api/v1/marketing/artifacts/{id}/social-handoff` `{ "revisionHash" }` |

## UI states

- **Disabled:** `403 SOCIAL_MARKETING_DISABLED` or marketing `503 MKT_DISABLED`.
- **Approval unavailable:** member (non-owner) sees decide errors `UNAUTHORIZED_APPROVER`.
- **Schedule blocked:** `503 NOT_CONFIGURED` when execution gates off; `202` with blocked code when gates on.
- **Handoff blocked:** `handoffState: "BLOCKED"` when external handoff flags off.
- **Connect:** always show `authorization.oauthConnectEnabled === false` with deferred reason; no connect button that calls OAuth.

## Locales

Keep EN/ES copy aligned with existing Marketing Studio dictionaries; no new backend strings required for list labels.