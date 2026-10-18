# 12 — Deployment Topology, Hostinger/Docker, Vercel and Operations

**Status:** target topology plus **INFRA-02 repository assets** (`infra/services/**`). Hostinger VPS capacity, Docker placement, and live staging startup remain **BLOCKED** pending owner inventory. Do not change/restart live Stocksist services. Postiz at `app.webbxxl.com` is an **existing** deployment (read-only probe 2026-10-18: Postiz register UI); separate staging uses project `webxxl-stg-postiz` only on an approved host.

## 1. Deployment diagram

```mermaid
flowchart LR
 USERS[Customers / WebXXL staff] --> EDGE[WebXXL Vercel Next.js\nAuth.js / APIs / customer & admin UI]
 EDGE --> DB[(WebXXL Supabase Postgres / Prisma)]
 EDGE --> SEC[Secrets manager / restricted tokens]
 EDGE --> PUB[Postiz isolated Docker application\napp.webbxxl.com proposed existing]
 EDGE --> CW[Chatwoot isolated service + own data/queue]
 EDGE --> PW[Paperclip isolated internal workforce]
 EDGE --> WF[Notification worker + Prisma workflow worker (AUTO-10)]
 EDGE --> EXT[Twilio / Resend / Google / Payment / domain APIs]
 WF --> GIT[Cursor Cloud / GitHub PR / Vercel review workflows]
```

### Ownership and hosting

| Surface | Tool/system | Scope |
|---|---|---|
| Public, customer/admin UI and reusable components | v0.app | ALL visual UI/UX and frontend interactions, including mobile and accessibility |
| Backend, schema, integrations, AI logic, events, tests, Git and deployment logic | Cursor | No overlapping UI file edits unless owner separately explicitly reassigns |
| WebXXL Next.js server/runtime | Vercel | Production/preview deployment; independently scoped env vars |
| Domain / DNS | Existing registrar/domain DNS | WebXXL and special-purpose service subdomains; no cutover without approval |
| Postiz | Existing Hostinger/Docker candidate | Activate/harden existing app; do not create duplicate scheduler |
| Chatwoot / Paperclip / Twenty candidate / Hatchet candidate | Separate isolated Docker services/managed option | Version-pinned, own DB/cache/network and backups; enable only after gated POC |
| Stocksist | Existing independently operated system | Isolation: no accidental container/network/volume/secret reuse |

## 2. Infrastructure inventory before purchases

Owner provides/screenshots or Cursor reads authorized Hostinger VPS: operating system, vCPU count, RAM total/free, disk capacity/free, uptime, load/CPU, Docker Compose projects, container names, networks, volumes, exposed ports, TLS reverse proxy, backups/restore options, management plane and whether Stocksist shares hardware. Confirm current social Postiz app at `app.webbxxl.com`, DNS ownership, actual Postiz data and linked social platform approval state. Prefer a **separate VPS** if agent workloads threaten running trading/production systems; don't assume one Hostinger machine can safely run all services. Docker expertise/infrastructure can be reused without reusing production secrets.

## 3. Environment separation

- `development`: synthetic businesses/contacts, test sender identities, no production API keys, feature flags free to iterate.
- `staging`: realistic encrypted test data only, replica schemas, isolated services, provider sandbox/test identities, small controlled cost and approved social test accounts.
- `production`: separate secret store, domain/TLS and DB/service accounts, explicit user authorization, permitted channels, backup runbooks and live provider registrations.

Each stack uses pinned images/digests, separate deployment manifests and volume ownership, healthcheck, container resource limits, restart policy and downtime notifications. Service deployment lives in `infra/services/*` (INFRA-02) or its own infrastructure repo, **not by copying third-party application source into WebXXL Next.js tree**. Staging gate: [infra/services/shared/STAGING-GATE.md](../../../infra/services/shared/STAGING-GATE.md). Retain upgrade rollback and security patch windows.

### INFRA-02 pinned staging references (repository)

| Service | Compose project | Local bind (staging file) | Upstream pin documented in repo |
|---|---|---|---|
| Chatwoot | `webxxl-stg-chatwoot` | `127.0.0.1:13000` | `chatwoot/chatwoot:v4.18.0-ce` |
| Postiz (separate staging) | `webxxl-stg-postiz` | `127.0.0.1:14007` only (Temporal UI/gRPC not host-published) | Overlay on [gitroomhq/postiz-docker-compose](https://github.com/gitroomhq/postiz-docker-compose); app tag **v2.25.1**; Compose **v2.24+** merge tags |
| Paperclip | `webxxl-stg-paperclip` | `127.0.0.1:13100` | Build from [paperclipai/paperclip](https://github.com/paperclipai/paperclip) tag **v2026.325.0** + override |

## 4. Suggested subdomains (reserved — not created)

`www.webbxxl.com` = existing portal domain; `app.webbxxl.com` = existing Postiz candidate; `crm-internal.webbxxl.com`/`inbox.webbxxl.com`/`agents-admin.webbxxl.com` possible strictly controlled administrative endpoints, to be chosen after DNS inventory and license/branding review. Prefer private network/Tailscale/VPN for internal admin, no public wide-open Paperclip. No hardcoded subdomains in client apps; configuration-driven URL registry. Domain cutover and site previews remain separate flows.

## 5. Secret / environment configuration contract (names illustrative)

| Variable group | Examples | Notes |
|---|---|---|
| App identity | `AUTH_SECRET`, existing Auth.js env, `DATABASE_URL`, `DIRECT_URL` | Existing configurations remain; never copy values into docs |
| Service endpoints | `POSTIZ_BASE_URL`, `CHATWOOT_BASE_URL`, `WORKFORCE_BASE_URL`, `WORKFLOW_BASE_URL` | Use verified HTTPS/isolated endpoints per env; existing `NEXT_PUBLIC_SCHEDULER_URL` remains until adapter migration |
| Provider auth | `POSTIZ_TOKEN_SECRET_REF`, `CHATWOOT_API_SECRET_REF`, `TWILIO_*_SECRET_REF`, `RESEND_*_SECRET_REF` | Recommended opaque secret references, not literal required upstream variable names |
| AI runtime | `AI_MODEL_PROVIDER`, `AI_API_SECRET_REF`, agent budget config | Account/instance tool policies server side |
| Google | OAuth client ID/secret ref, GSC/GA4/GBP scopes | Owner-approved connection per managed site |
| Payments | `BILLING_PROVIDER`, per-env webhook secret refs | Provider choice pending; no raw card data |
| Feature flags | `marketingStudio`, `crm`, `postiz`, `seo`, `aiEmployees`, `voice`, `sms`, `billing` | Implement or map against existing `config/features.ts`; UI flag not an authorization boundary |

Actual environment-variable names must follow upstream versions and current repo conventions. Record scopes, rotation method and operator, **never the secret**.

## 6. Existing and future worker relationship

`lib/automation/worker.ts` processes notification deliveries with retries and event IDs; SMS/WhatsApp remain disabled. **AUTO-10** adds PostgreSQL-backed `WorkflowJob` execution (`lib/platform/workflow/*`, `PrismaWorkflowProvider` with `FOR UPDATE SKIP LOCKED` claiming) plus conditional claim/fencing on `AutomationDeliveryJob`. **Do not replace or disable** the legacy notification worker. All `WORKFLOW_*` flags default **OFF**; no live cron in this batch. Hatchet remains an optional future adapter (`hatchet-provider-seam.ts`); Prisma-first per `AUTO10-PROVIDER-DECISION.md`. Postiz remains the sole social post scheduler.

## 7. Reliability and SLO targets (proposed, not measured)

- Interactive dashboard target: p95 core page response below 2s under agreed reference environment; analytics can load asynchronously from precomputed snapshots.
- Gateway availability target: >=99.9% monthly after production stabilization, with provider outages separately disclosed.
- No missing/duplicate charges or unauthorized sends; financial/security correctness takes priority over throughput.
- Worker queue: alert on oldest actionable job age, stuck leases, dead letters, unprocessed provider callbacks and reservation aging.
- Recovery: documented RPO/RTO by component before production launch; initial proposed RPO <=24h for nonfinancial analytics and tighter for CRM/ledger, backed by actual PITR and provider reconciliation. Final targets require hosting capability/cost signoff.
- Load test 10 independent sites and scale toward 100/1,000 accounts through horizontally scalable workers, per-tenant fairness and DB indexes; sizes are staged capacity targets, not claimed production load.

## 8. Operations and recovery runbooks

1. Health check for Vercel, Supabase, Postiz, Chatwoot, Paperclip, worker runner, secret store, external API connectivity.
2. Backups: PostgreSQL PITR/regular backup, Postiz/Chatwoot/Twenty dedicated DB and object storage, configuration, audit ledger; encrypt and document restore ownership.
3. Restore drill uses isolated staging (no mass resend or retroactive wallet debit); replay signed provider events safely from checkpoints.
4. Incident management: suspend affected account/provider/sender/agent; place campaigns in paused state; notify staff; reconcile financial events before resuming.
5. Provider rotation and revocation; account/site offboarding and data export; license notices, security patches and CVE monitoring.
6. Cost observability: per-platform AI token cost, SMS segments/carrier fee, Google API usage, social image generation, worker compute, hosted DB and storage.
7. Canary release via Vercel preview and nonproduction external service test; signed approval for production, rollback reference, handoff after release.

## 9. First Hostinger user checklist

- [ ] Hostinger sign-in and VPS ID, vCPU/RAM/SSD/free capacity and week-long utilization captured.
- [ ] Existing Docker projects/port map and Stocksist isolation confirmed.
- [ ] Backups/PITR/restore options checked.
- [ ] Postiz container health/version/API docs and `app.webbxxl.com` reachable verified.
- [ ] Available DNS and subdomain mapping documented.
- [ ] Decide separate staging VPS or safe isolated capacity **before provisioning anything**.
