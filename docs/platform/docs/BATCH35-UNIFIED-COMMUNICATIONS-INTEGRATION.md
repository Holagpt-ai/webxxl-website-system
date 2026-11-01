# Batch 35 — Unified Communications Integration V1

**Status:** IN PR (Cursor) · **ADR:** not required (extends COMMS-06, WALLET-09, Batch 20A/20C)

## Scope

- Chatwoot integration readiness (`chatwoot-readiness-service.ts`) and `GET /api/v1/communications/provider-readiness`.
- Unified outbound authorization gateway (`outbound-authorization-gateway.ts`) for SMS/email prep — no live dispatch.
- Twilio/Resend sender readiness assessment (`messaging-provider-readiness.ts`) with A2P/domain distinctions; never VERIFIED without stored evidence.
- Wallet quote authorization prep (`wallet-quote-authorization.ts`) — no ledger mutation.
- Dispatch reconcile policy — unknown or unproven delivery stays `RECONCILIATION_REQUIRED`.
- Execution gates: `COMMS_INTEGRATION_GATES_ENABLED` (default OFF).

## Explicit exclusions

No Chatwoot install, Twilio/Resend activation, live sends, production migrations, v0 UI, or second worker engine.
