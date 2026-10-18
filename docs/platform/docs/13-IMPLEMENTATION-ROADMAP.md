# 13 — Dependency-Ordered Implementation Roadmap & Owner Activities

**Execution mode:** Cursor primary for backend/logic/Git; v0.app exclusively all UI/UX; Vercel for WebXXL deployment; Hostinger/Docker for approved isolated providers. Large cohesive non-overlapping implementation batches, focused validation, honest results. **Document freeze first, implementation second.** Dates below are **not fixed commitments**. Do not let optional vendors block unrelated core modules.

## Program release strategy

**Foundation to customer value:** preserve current customer portal, establish group identities and policies, deploy safe internal agents, activate free Postiz/Marketing Studio and robust CRM/Chatwoot, execute SEO reporting, and add shared wallet/payment/service-commerce infrastructure. Feature flags permit staged release without scope cuts. Future AI employee purchasing and regulated voice/campaign classes remain architected but gated.

| Batch | Dependencies | Cursor/backend deliverables | v0.app deliverables | Owner activities | Minimum acceptance |
|---|---|---|---|---|---|
| **DOC-00** Spec freeze | Current docs | Reconcile README/TAD against real main code and schema, create versioned documentation PR, no product code | Review screenshot fidelity of wireframes | Approve TAD version, free eligibility open questions | No contradictory modules/routes/pricing; docs committed after approval |
| **FOUND-01** Shared identity/data | DOC-00 | **Implemented in source (unmerged):** `BillingGroup` / membership / roles / profile / spending policy, wallet contracts, entitlement classifications, provider + AI tool registries, additive migration. **Not deployed. Production migration not applied.** | Context header/account/group display contracts — still v0.app, not started | Identify ABMED group payer and operating account owners | Focused FOUND-01 unit tests cover isolation, 1000→650 synthetic wallet, FREE vs PAID, denied AI tools, existing project auth |
| **INFRA-02** Isolated service staging | FOUND-01 + VPS inventory | **In progress (repo):** `infra/services/**`, staging scripts, inventory + Postiz probe, integration contracts. **Live staging BLOCKED** until VPS approval | None except status/shell mocks later | Hostinger VPS specs, backups, DNS; approve resources; `WEBXXL_STAGING_CONFIRM` | Existing Stocksist/WebXXL unchanged; signed-off isolated services |
| **AGENT-03** Internal AI workforce | INFRA-02 | **In progress (repo):** five internal agents, task/approval/budget/pause engine, synthetic workflows, Paperclip adapter stub (pin v2026.325.0); **live execution OFF** | Admin workforce screens when APIs ready | Cursor Cloud/API and GitHub access, budget cap; enable flags only after pilot | Synthetic supervised workflows pass; no production agents |
| **SOCIAL-04** Activate Postiz + FREE Marketing Studio | INFRA-02, FOUND-01 | **In progress (repo):** Marketing Studio domain, Postiz Public API adapter (docs.postiz.com), Prisma models, `/api/v1/social/*`, mocked Vitest; **live publishing OFF** | Marketing Studio FREE UI (v0.app, not started) | Postiz API credentials, OAuth per platform, content policy; **OPEN-001** eligibility | Mock schedule/reconcile tests pass; no cross-account posting |
| **CRM-05** Robust CRM backend pilot | FOUND-01, INFRA-02, SOCIAL-04 on `main` | **Merged (`9652f0f`):** native Prisma CRM + extended `CrmProvider`, Twenty candidate, CRM-05A integrity; migrations **pending apply** | CRM FREE list, filter, contact 360, pipelines, tasks | Approve final CRM vendor after POC; sample fields/segments | Full contact feature matrix; independent account workspaces |
| **COMMS-06** Chatwoot and messaging policy | CRM-05 + FOUND-01 | **In PR:** Chatwoot tenant mapping, typed Application API adapter, webhook relay auth, policy/gateway/quotes, `/api/v1/communications/*`; **live Chatwoot/SMS OFF** | Communication inbox, contact timeline, approvals | Determine sender identities and permitted contact use | No provider path bypasses consent/billing, synthetic data only |
| **SEO-07** Local SEO & Google sources | FOUND-01, AGENT-03 | **In PR:** bounded crawler + SSRF guards, Prisma SEO models, GSC adapter (mock), APIs `/api/v1/seo/*`, dashboard DTO; **live Google/crawl OFF** | Local SEO FREE dashboard, connections, competitor and work queue | Authorize GSC/GA4/GBP accounts and properties as available | No fake metrics; evidence/per-site isolation; empty states |
| **MKT-08** AI landing pages/creative/follow-up | SOCIAL-04, CRM-05, SEO-07 | **In PR:** `lib/platform/marketing/*`, Prisma migration `20261018240000_mkt08_foundation`, `/api/v1/marketing/*`, deterministic drafts + lead monitor + approval integrity; **all `MKT_*` flags OFF**; no live LLM/send/publish | Creative/deliverable screens, action center, approval flow | Provide business knowledge, brand materials, approve example claims | Reviewable artifacts; customer approval before publish/send |
| **WALLET-09** Shared credits + SMS/email provider | COMMS-06, FOUND-01 | Atomic wallet/ledger/reservations, group payer, Twilio/Resend adapters, rate plan, reconciliation, account spend caps | Wallet/group costs, top-up, campaign quote/status | Create/verify Twilio parent, sender registrations, confirm Resend account and eligible sending domains; select terms | ABMED 1,000→650 example; concurrent holds; no PHI leakage |
| **AUTO-10** Durable execution scale | AGENT-03, COMMS-06, SOCIAL-04, WALLET-09 (on `main`) | **In PR:** `PrismaWorkflowProvider`, outbox, lease/fencing SQL, safe handlers, legacy notification claim hardening; **Hatchet not provisioned** (see AUTO10-PROVIDER-DECISION.md); all `WORKFLOW_*` OFF | Worker run history / repair UI (v0.app, not started) | Approve worker cron + flag rollout only after review | No double send/debit; Postiz remains publisher; PG concurrency verified separately |
| **COMMERCE-11** Group checkout/services | WALLET-09 + price/catalog and provider signoff | Extend existing `ServiceOrder` and `CustomerService`, provider-neutral checkout/subscriptions, invoice/fulfillment adapters and AI SKU flag | Marketplace FREE vs paid catalog, group invoices/checkout | Choose processor, domain/reseller/email vendors, billing policies | Shared payer buys domain/subscription without using SMS wallet |
| **AI-CUSTOMER-12** Customer AI employees | CRM-05, COMMS-06, MKT-08, COMMERCE-11 | Per-account/tenant agent instances, knowledge/policies, receptionist/chat/handoff and deferred AI-agent SKUs | AI Employees management + future disabled store | Approve FAQs, escalation, optional future SKU pricing | Ten independent instances, scoped tools, no unauthorized outreach |
| **ANALYTICS-13** Expansion | SEO-07 and customer OAuth | GA4/GBP/other supported metrics and optional licensed local rank provider; account dashboards | Traffic/conversion and local rank views with provenance | Connect provider accounts, accept selected rank provider costs | Metrics sourced, dated and clearly not fabricated |
| **RELEASE-14** Customer acceptance | Prior implemented features | Comprehensive staging e2e, licenses/BAAs/consent reviews, migration rehearsals, SLO/security recovery tests | Mobile/EN/ES consistency, browser end-to-end | Approve commercial launch, provider registrations, site policies | All release-gate tests and owner written signoff |
| **FUTURE-15** Deferred extensions | RELEASE-14 | Regulated voice, WhatsApp advanced, paid AI employees, white-label reseller, external ads, more providers, advanced DNS/email | Feature-flagged new screens | Separate business/compliance approvals | Expansion with no replacement/downgrade of core platform |

### Parallelism and invariants

- UI contracts can be produced by v0 while Cursor handles distinct backend files, but **never same file paths concurrently**.
- Postiz activation/social and CRM/SEO work can progress after core account/tool contracts, without waiting for payment selection.
- Wallet and commerce architecture contracts written early; production payment processing remains gated until provider selection/terms.
- Existing website development/approvals and ABMED redesign should proceed independently; new platform work cannot block deferred Resend ABMED production cleanup.
- Existing automations/notification worker remains; Hatchet is introduced only for justified scalable execution tasks.

## Detailed user action register (no unnecessary registrations)

| When | Exact human task | Necessary account / payment? |
|---|---|---|
| DOC-00 | Read approved TAD and confirm FREE service eligibility for unsubscribed prospects; designate ABMED group billing owner | No |
| INFRA-02 | Hostinger hPanel → VPS → Overview: capture vCPU, RAM, disk/usage; Docker projects; backups; Postiz container/version | Existing Hostinger account |
| INFRA-02 | Decide/approve separate staging VPS if co-location threatens Stocksist; reserve service DNS if required | Possible hosting cost only after capacity report |
| AGENT-03 | Verify Cursor Cloud Agents/API and GitHub access, set pilot cost cap; issue/restrict tokens in secret manager | Existing accounts; potential AI API usage |
| SOCIAL-04 | Authorize selected social platform developer apps/OAuth accounts, connect only test business social identity first | Existing social accounts; platform approval requirements |
| CRM-05 | Decide Twenty/community vs alternative after POC and license/compliance summary | No mandatory SaaS CRM registration |
| COMMS-06 | Approve consent form copy, allowed outreach templates, lead thresholds, group account contact rules | No live contact import during tests |
| SEO-07 | Enable/access Google Cloud project/OAuth consent screen if needed; add Search Console verified properties; connect GA4/GBP later | Existing Google account or dedicated Google Cloud project |
| MKT-08 | Supply approved logos, services, images, EN/ES tone and regulated claims for each site | No |
| WALLET-09 | Register/confirm WebXXL Twilio parent account, billing, A2P business verification + child sender use cases, only when ready | Twilio account and potential registration/carrier fees |
| WALLET-09 | Use existing Resend account; verify eligible sending domains/DNS; keep PHI out | Existing Resend account |
| COMMERCE-11 | Select payment processor/merchant-of-record, domain and email providers, top-up/credit refund terms | Account registration and possible fees **then**, not now |
| RELEASE-14 | Complete privacy/healthcare and messaging legal approvals as applicable and approve live audience/production activation | Qualified review may be required |

## Provider go/no-go checklist

For each third-party service: actual version+license, admin access, supported feature/edition, tenant mapping, OAuth/secret scope, self-host operating cost, APIs and webhooks, test environment, limits, failover/data export, exit plan. For Twenty, Chatwoot and Postiz specifically check that community edition and branding/embedding strategy lawfully support our commercial model. Provider approval is per integration; no one vendor locks WebXXL data model.

## FOUND-01 status (merged 2026-10-18)

```
Batch ID: FOUND-01 / TAD v1.0.0 / Cursor
Merged: PR #33 @ 68c5fde5345813899e2db34ac422a90cb5956f52
Production migration: NOT APPLIED from INFRA-02
Next: INFRA-02 PR (repository assets) → owner VPS gate → AGENT-03 / SOCIAL-04 / COMMS-06
```

## INFRA-02 status (2026-10-18)

```
Batch ID: INFRA-02 / TAD v1.0.0 / Cursor
Deliverables: infra/services (Chatwoot compose, Postiz overlay + existing instance doc, Paperclip override), scripts, inventory, lib/platform/integrations/*
Live staging: BLOCKED (no Hostinger mutation; VPS capacity unknown)
Postiz app.webbxxl.com: reachable Postiz UI; do not overwrite
Tests: __tests__/infra/infra02-static-validation.test.ts + validate-config scripts
Next batch after merge + owner approval: SOCIAL-04 (Postiz API) on approved staging or AGENT-03 pilot after Paperclip staging + flags

## AGENT-03 status (2026-10-18)

```
Batch ID: AGENT-03 / TAD v1.0.0 / Cursor
Prerequisites: INFRA-02 merged @ 7277f94
Deliverables: lib/platform/workforce/*, config/workforce.ts, paperclip-workforce adapter, migration 20261018130000_agent03_internal_workforce
Runtime: INTERNAL_WORKFORCE_ENABLED=false, PAPERCLIP_EXECUTION_ENABLED=false (default)
Tests: __tests__/platform/agent03-workforce.test.ts, __tests__/platform/agent03a-workforce-corrections.test.ts (synthetic only)
AGENT-03A: operator-auth hardening, budget integrity, ON DELETE RESTRICT history protection (pending migration)
Next: owner-approved Paperclip staging pilot + Cursor/GitHub scoped integration (not in this batch)
```

## Effort expectations — directional only

Docs/design and current-state reconciliation: several focused working days. Working isolated internal worker & Postiz/Chatwoot staging: days to weeks depending on VPS/social OAuth. Integrated CRM, SEO, wallet and AI marketing: multiple substantial backend/UI batches across weeks/months, not guaranteed 2-day plug-and-play. Carrier and Google/social app approvals may take independent external time. This is **not** a costed project schedule until infrastructure and provider accounts are inventoried.

## Implementation status tracking template

```
Batch ID / TAD version / owner
Inputs and prerequisites:
Exact changed files and migrations:
Existing workflows preserved:
Actual tests (with dates/log references):
Git branch/commit/PR / merged?:
Preview/staging/production status (separate):
External dependencies and user next actions:
Blocked/deferred with reason:
Next one implementable batch:
```
