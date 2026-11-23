# BATCH 14 — Communications & analytics HTTP completion

**Status:** IN PR · **Baseline:** `main` @ `e7f51fe261d24220549a96a58a93d81100e74f3c` (PR **#150** MERGED Batch 13).

## Scope

Closes remaining customer-account communications read/handoff and analytics drill-down HTTP surfaces for dashboard integration and Batch 16 workspaces. No live Chatwoot/Twilio/Resend dispatch, marketing sends, provider OAuth, or production migrations.

## Communications (new / extended)

| Surface | Method | Path |
|---|---|---|
| Inbox mapping detail | GET | `/api/v1/communications/inboxes/{inboxId}` |
| CRM contact comms handoff (read-only) | GET | `/api/v1/communications/contacts/{contactId}/handoff` |
| Connections authorization contract | GET | `/api/v1/communications/connections` → adds `authorization` |
| Marketing follow-up outreach prepare | POST | `/api/v1/marketing/follow-ups/{id}/prepare-outreach` |

`lib/platform/comms/http.ts` maps `AuthError` → stable `401` for new and updated comms routes.

## Analytics drill-down (new)

| Surface | Method | Path |
|---|---|---|
| Acquisition rows | GET | `/api/v1/analytics/accounts/{accountId}/acquisition` |
| Stored metric series + provenance | GET | `/api/v1/analytics/accounts/{accountId}/measurements?metric=` |
| Conversion daily breakdown | GET | `/api/v1/analytics/accounts/{accountId}/conversions/{conversionKey}` |

Responses use stored `SeoMetricObservation` / `AnalyticsConversionObservation` only (`provenance` + `measuredAt` / `sourceRef`).

## Dashboard context (Batch 10B extension)

- Correct communications module APIs (`/api/v1/communications/*`, not `/api/v1/comms/*`).
- `crossModule.communicationsWorkspaces` and `crossModule.analyticsWorkspaces`.
- Analytics module `apis` include traffic/search/local/conversions/measurements/readiness with `{customerAccountId}` resolved from session.

## Gates (unchanged)

- `COMMS_BACKEND_ENABLED`, `COMMS_INTEGRATION_GATES_ENABLED`, outbound/sender flags.
- `ANALYTICS_BACKEND_ENABLED`, ingestion and live provider transport flags.
- Live dispatch, OAuth connect, and wallet funding remain owner-gated.

## Tests

`__tests__/platform/batch14-comms-analytics-http.test.ts` plus `batch10b-customer-dashboard-integration`.

## Deferred

- Live Chatwoot connect, SMS/email dispatch, communications campaign CRUD (`04-API-INTEGRATIONS` deferred routes).
- AUTH-STAGING-8C customer browser matrix.
- Batch 10A pending production migration.