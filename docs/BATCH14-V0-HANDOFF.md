# v0 — Batch 14 Communications & Analytics HTTP (presentation only)

Backend on Cursor-owned paths. Do **not** edit `app/api/**` or `lib/platform/**`.

## Communications workspace

| UX | API |
|---|---|
| Inbox list | `GET /api/v1/communications/inboxes` |
| Inbox detail (connections filters) | `GET /api/v1/communications/inboxes/{inboxMappingId}` |
| Conversation list / detail | Existing `COMMS_API` paths in `lib/comms-ui/types.ts` |
| Connections cards | `GET /api/v1/communications/connections` → `chatwoot` + `authorization.inboxes[]` |
| CRM contact outreach prep panel | `GET /api/v1/communications/contacts/{contactId}/handoff` |
| Marketing follow-up send prep | `POST /api/v1/marketing/follow-ups/{id}/prepare-outreach` — no live send |

Render `authorization.oauthConnectEnabled === false` and `dispatchAllowed === false`. Map `503 COMMS_DISABLED` to disabled panel (EN/ES).

## Analytics workspace

| UX | API |
|---|---|
| Overview tabs (existing client) | `overview`, `traffic`, `search`, `local`, `conversions`, `trends`, `sync-status` |
| Acquisition table | `GET .../acquisition?siteId=&start=&end=` |
| Metric drill-down (sessions, etc.) | `GET .../measurements?metric=ga4.sessions&siteId=&start=&end=` — show `provenance`, `sourceRef`, `observedAt` |
| Conversion detail | `GET .../conversions/{conversionKey}?siteId=&start=&end=` — daily `STORED_CONVERSION_AGGREGATE` rows |

Use `crossModule.analyticsWorkspaces` tab paths from dashboard context when wiring subnav.

## Dashboard context

`GET /api/v1/portal/dashboard-context` now includes `communicationsWorkspaces` and expanded module `apis`. Prefer server-provided paths over hard-coded `/api/v1/comms/*`.