# WebXXL isolated specialist services (INFRA-02)

Deployment-ready **staging** definitions for Chatwoot, Postiz, and Paperclip. These assets live in the WebXXL repository; they do **not** activate production or Hostinger workloads by themselves.

## Staging activation gate

Live startup is **BLOCKED** until the owner explicitly approves:

1. Target host (dedicated staging VPS **recommended** when Stocksist or production Postiz share hardware).
2. Recorded VPS capacity (vCPU, RAM, disk, utilization).
3. Isolated Docker project names (`webxxl-stg-*`) and no shared networks/volumes with Stocksist.
4. Secret injection via host secret store (never committed).
5. Read-only health checks passing on the approved host.

See [shared/STAGING-GATE.md](./shared/STAGING-GATE.md) and [shared/inventory-2026-10-18.md](./shared/inventory-2026-10-18.md).

## Layout

| Path | Purpose |
|---|---|
| [chatwoot/](./chatwoot/) | Pinned CE stack (Rails + Sidekiq + Postgres pgvector + Redis) |
| [postiz/](./postiz/) | Existing `app.webbxxl.com` inventory + separate staging overlay for official compose |
| [paperclip/](./paperclip/) | Internal workforce staging (build from upstream; no app source vendored here) |
| [shared/](./shared/) | Cross-service env examples, logging/backup policy |
| [scripts/](./scripts/) | Preflight, validate, scoped up/down, read-only health |

## WebXXL integration (code)

- Provider interfaces: `lib/platform/providers/*` (FOUND-01).
- Staging endpoint contract: `lib/platform/integrations/isolated-services.ts`.
- Chatwoot tenant mapping: `lib/platform/integrations/chatwoot-account-mapping.ts`.
- Postiz link-out stub: `lib/integrations/scheduler.ts` (unchanged behavior; discovery helper added in INFRA-02).

## Explicit non-goals (this batch)

- No DNS, TLS, or Hostinger mutations.
- No Twilio, Resend, payment, or live social publishing.
- No Twenty CRM or Hatchet installation.
