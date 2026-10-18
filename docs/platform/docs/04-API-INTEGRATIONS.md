# 04 — WebXXL API & Integration Specification

**Status:** target contracts, **not implemented route inventory**. `api/v1` names are proposed external/internal namespaces: Cursor must map to existing Next.js routes/server actions before adding routes. Prefer service functions shared by server actions and REST handlers. API schemas are illustrative normative contracts to refine with OpenAPI and actual Prisma names during batch 01.

## 1. Application service boundaries

| Provider interface | Initial adapter / candidate | Primary actions | Authoritative WebXXL state |
|---|---|---|---|
| `CrmProvider` | Twenty POC; EspoCRM/Corteza/native fallback | create/update/search contacts, company, pipeline, task, segments, import/export | account-scoped canonical contact refs, consent, permission |
| `ConversationProvider` | Chatwoot | account/workspace mapping, contacts, inboxes, conversations, events, human handoff | account mapping, interaction references, audit |
| `SocialPublisherProvider` | Postiz | connect/list channels, create/schedule/post, outcome, analytics | approved campaign and artifact version |

**SOCIAL-04 implemented backend routes (gated):** `GET /api/v1/social/connections`, `GET|POST /api/v1/social/campaigns`, `POST /api/v1/social/campaigns/{id}/revisions`, `POST /api/v1/social/campaigns/{id}/approve` (501 until pilot), `POST /api/v1/social/campaigns/{id}/schedule` (503 when live publishing disabled), `GET /api/v1/social/publications`, `GET /api/v1/social/calendar`. Postiz Public API reference: `GET/POST /public/v1/integrations`, `GET/POST /public/v1/posts` ([docs.postiz.com/public-api](https://docs.postiz.com/public-api)).

**CRM-05 implemented backend routes (gated, `CRM_BACKEND_ENABLED=false` default):** `GET|POST /api/v1/crm/contacts`, `GET|PATCH /api/v1/crm/contacts/{id}`, `GET /api/v1/crm/contacts/{id}/timeline`, `GET|POST /api/v1/crm/companies`, `GET /api/v1/crm/pipelines`, `GET|POST /api/v1/crm/deals`, `GET|POST /api/v1/crm/tasks`, `GET|POST /api/v1/crm/segments`, `POST /api/v1/crm/imports/preview`, `POST /api/v1/crm/imports/commit`, `POST /api/v1/crm/exports`. Import/export additionally require `CRM_IMPORT_ENABLED` / `CRM_EXPORT_ENABLED`.
| `WorkforceProvider` | Paperclip for internal | register agents, assign tasks, poll run, cost/status/approval | agent instance grants, task, execution, approval |
| `WorkflowProvider` | existing worker + Hatchet POC | enqueue, cancel, resume, signal, observe | WebXXL domain job/outbox state |
| `SmsProvider` | Twilio first / Telnyx or Bandwidth optional | subaccounts, sender registration, send, status, inbound | consent/suppression, wallet and message policy |
| `EmailProvider` | Resend for non-PHI; regulated alternative later | verify sender, send, bounce, unsubscribe | consent, allowed content, message ledger |
| `VoiceAgentProvider` | ElevenLabs or LiveKit POC | launch compliant call, record disposition, safe handoff | explicit consent, voice policy and audit |
| `SeoSourceProvider` | GSC, GA4, GBP, Places, approved rank provider | OAuth/connect, page/search/traffic/local performance | snapshots, source/market definitions |
| `WebsiteAdapter` | GitHub/Vercel/managed site | scan/preview/change/PR/deploy after approval | website project, approval version, source commit |
| `PaymentProvider` | Stripe/Paddle/Lemon Squeezy TBD | checkout, payment authorization, invoice, subscription, refund | WebXXL order, price version, group payer and wallet |
| `DomainRegistrarProvider` | future registrar/reseller TBD | availability, quote, register, DNS, renew | account order, domain ownership and billing entitlement |

Provider APIs must be accessed server-side through customer-scoped credentials or account-level mappings. A service adapter must never trust a client-supplied external Chatwoot/Postiz/Twilio account ID without WebXXL lookup.

## 2. Cross-cutting API protocol

- HTTPS; Auth.js session for portal endpoints, service-to-service identity/rotating secret or signed short-lived token for machine APIs.
- Validate JSON at boundaries with a schema library; reject unexpected fields for sensitive actions.
- Every state-changing request carries `Idempotency-Key` or deterministic key + WebXXL actor/account/site/business context. `requestId`, `correlationId`, `traceId` linked in audit.
- Server resolves active membership, target `CustomerAccount`, optional `Site`, and separate `BillingGroup` authorization. Never authorize via `accountId` or cookie value alone.
- Return `409 conflict`, `403 forbidden`, `402 insufficient_credits` (as domain code, API status may vary), `422 validation/consent`, `429 quota`, `503 provider_unavailable`. Responses include stable error code, retriable flag, no secret detail.
- External provider webhook ingress validates signature/body timestamp, rotates keys, deduplicates event IDs, stores minimum necessary payload, and dispatches via inbox/outbox.
- Pagination cursors instead of unbounded full data; export jobs asynchronous and time-limited with audit.
- Multi-tenant rate limits and free AI fairness policies enforced at API/service layer.
- Use `/api/v1/` as stable proposed namespace; UI may consume typed server actions but must not bypass policies.

### Example business context / response envelopes

```json
{
  "context": {
    "customerAccountId": "acct_physicians",
    "managedSiteId": "site_physicians_web",
    "billingGroupId": "group_abmed"
  },
  "requestId": "req_example_001",
  "idempotencyKey": "campaign-001-request-1"
}
```

The server recomputes/validates all IDs from actor membership, not from user input. The `billingGroupId` may be omitted on request and resolved authoritatively.

```json
{
  "data": {"id": "resource_example", "status": "PENDING_APPROVAL"},
  "meta": {"requestId": "req_example_001", "source": "webxxl", "asOf": "2026-10-17T00:00:00Z"}
}
```

## 3. Endpoint inventory — normalized contract

| Method/path (proposed) | Actor / permission | Important request | Return and domain side effect |
|---|---|---|---|
| `GET /api/v1/accounts` | authenticated user | cursor | authorized business accounts only |
| `POST /api/v1/accounts/{id}/activate` | account member | account ID | issue validated account selection; no billing effect |
| `GET /api/v1/billing-groups` | group billing member | cursor | group summaries without sibling CRM |
| `POST /api/v1/billing-groups/{id}/memberships` | group owner + account owner | target account, policy, proof | approval/audit event; no implicit contact sharing |
| `GET /api/v1/billing-groups/{id}/wallet` | group wallet viewer | — | posted/held/available and snapshot timestamp |
| `POST /api/v1/wallet-topups/quote` | billing admin | group, pack, currency | price/tax/provider quote, expiry |
| `POST /api/v1/wallet-topups/checkout` | billing admin | quote ID | provider-neutral checkout session |
| `GET /api/v1/wallet-transactions` | billing viewer | account/site/time filters | auditable group ledger and per-site spending |
| `GET/POST /api/v1/crm/contacts` | account CRM roles | filters or normalized record | account-scoped contacts incl mapped provider ID |
| `POST /api/v1/crm/imports` | CRM import role | CSV upload, field mapping | asynchronous preview/dedupe/consent-preserving import |
| `GET /api/v1/crm/exports` | CRM export role | scope/filters | export job/status and audited secured retrieval |
| `GET/POST /api/v1/crm/segments` | CRM roles | filters/rules | saved static/dynamic segments |
| `GET /api/v1/crm/contacts/{id}/timeline` | CRM reader | pagination | source-attributed omnichannel timeline |
| `POST /api/v1/crm/tasks` | agent/human tool grant | lead, assignee, deadline | create task and account event |
| `POST /api/v1/communications/quotes` | `comms.quote` | channel, purpose, recipient scope | dry-run eligibility counts; **COST_UNAVAILABLE** without configured unit cost |
| `POST /api/v1/communications/intents` | `comms.intent.prepare` | channel, purpose, recipient, idempotency | immutable content hash + policy decision; **no dispatch** |
| `GET /api/v1/communications/intents/{id}` | `comms.read` | — | intent status, recipients, dispatch attempts (metadata only) |
| `GET /api/v1/communications/inboxes` | `comms.read` | — | verified Chatwoot inbox mappings for operating account |
| `GET /api/v1/communications/connections` | `comms.read` | — | Chatwoot mapping state; outbound flags honest OFF |
| `POST /api/v1/communications/webhooks/chatwoot` | relay HMAC | signed body + idempotency | **503 until** `CHATWOOT_WEBHOOK_INGEST_ENABLED` + relay secret; quarantine unknown tenants |
| `POST /api/v1/communications/campaigns` | campaign creator | draft + consent scope | DRAFT only, immutable revision hash |
| `POST /api/v1/communications/campaigns/{id}/approve` | authorized approver | exact hash, budget | authorization; reserve credits transactionally |
| `POST /api/v1/communications/campaigns/{id}/dispatch` | service actor | approved campaign | enqueue per-recipient messages; never bypass wallet |
| `GET /api/v1/communications/conversations` | account inbox user | inbox/account filters | Chatwoot links and histories (redaction as needed) |
| `GET /api/v1/social/connections` | account social manager | site/account | authorized connected social identities only |
| `POST /api/v1/social/campaigns` | content creator | brief/platforms/cadence | DRAFT campaign |
| `POST /api/v1/social/campaigns/{id}/approve` | business approver | artifact version, channels, dates | immutable policy approval |
| `POST /api/v1/social/campaigns/{id}/schedule` | approved service actor | approvalRef | Postiz adapter posts approved content; saves external IDs |
| `GET /api/v1/social/publications` | account reader | date/platform filters | confirmed status + Postiz provenance |
| `GET /api/v1/seo/sites` | `seo.read` + membership | — | managed sites for operating account (`SEO_BACKEND_ENABLED`) |
| `GET /api/v1/seo/sites/{id}/overview` | `seo.read` | — | dashboard DTO sections A–J with honest data states |
| `GET /api/v1/seo/sites/{id}/pages` | `seo.read` | status, pagination | page inventory rows |
| `GET /api/v1/seo/sites/{id}/findings` | `seo.read` | pagination | crawl/rule findings |
| `GET /api/v1/seo/sites/{id}/opportunities` | `seo.read` | pagination | evidence-backed opportunities |
| `GET /api/v1/seo/sites/{id}/connections` | `seo.read` | — | analytics connection metadata (no secrets) |
| `GET /api/v1/seo/sites/{id}/performance` | `seo.read` | — | stored GSC observations or `NOT_CONNECTED` |
| `GET /api/v1/seo/sites/{id}/competitors` | `seo.read` | — | markets + top competitor profiles |
| `POST /api/v1/seo/sites/{id}/markets` | `seo.market.manage` | market definition | ranked competitor candidates (synthetic/live gated) |
| `POST /api/v1/seo/sites/{id}/scan-previews` | `seo.scan.prepare` | idempotency key | crawl run **prepared/blocked** — not arbitrary URL crawl |
| `POST /api/v1/seo/sites/{id}/connect/{source}` | `seo.configure` (future) | OAuth initiation | **not implemented in SEO-07** — contracts only |
| `POST /api/v1/marketing/requests` | marketing user | deliverable, site, brief, locale | job and source-bound deliverable request |
| `POST /api/v1/marketing/artifacts/{id}/approve` | approver | exact version, policy | AI handoff to PR/Postiz as appropriate |
| `GET/POST /api/v1/agents/instances` | account AI administrator | template, site, limits | preview/config only while future SKU disabled |
| `POST /api/v1/agents/instances/{id}/actions` | tool-granted agent | typed action + input | policy evaluation, approval or audited execution |
| `GET /api/v1/commerce/catalog` | customer | locale, account | FREE or priced offerings and feature availability |
| `POST /api/v1/commerce/orders` | buyer | SKU, account/site/group payer | WebXXL-owned order and quote, no charge until checkout |
| `POST /api/v1/commerce/checkout` | billing admin | authorized order | provider checkout + frozen price version |
| `GET /api/v1/automation/runs` | authorized actor | scope/status | job traces with secrets/PII redaction |
| `POST /api/v1/approvals/{id}/decision` | designated human only | immutable artifact hash, decision | cannot be spoofed by autonomous agent |

**Webhook ingress:** `/api/webhooks/chatwoot`, `/api/webhooks/twilio`, `/api/webhooks/resend`, `/api/webhooks/postiz` (only if supported by exact installed version), `/api/webhooks/billing/{provider}`, `/api/webhooks/agent-execution`. Verify exact provider event schemas and route names before coding; no assumption that a provider emits every desired event.

## 4. Example credit quote and authorization

```json
{
  "customerAccountId": "acct_aesthetics",
  "siteId": "site_aesthetics",
  "channel": "SMS",
  "purpose": "MARKETING",
  "senderIdentityId": "sender_aesthetics",
  "campaignRevisionId": "rev_8",
  "recipientSegmentId": "segment_approved_200"
}
```

Quote response contract:

```json
{
  "campaignRevisionId": "rev_8",
  "billingGroupId": "group_abmed",
  "totalSelected": 200,
  "eligible": 180,
  "ineligibleByReason": {"NO_VALID_CONSENT": 15, "SUPPRESSED": 5},
  "estimatedSegments": 195,
  "estimatedCredits": 195,
  "walletAvailableCredits": 1000,
  "ratePlanVersion": "sms-us-v1",
  "quoteExpiresAt": "2026-10-17T12:00:00Z",
  "sendAllowed": false,
  "reason": "APPROVAL_REQUIRED"
}
```

Values illustrative only. Approval consumes the exact hashed content and quote revision and reserves only when wallet has sufficient availability. Actual message route/number and segments are verified by provider. `sendAllowed` never becomes true based only on frontend display.

## 5. State machines / enums (proposed)

- Campaign: `DRAFT -> READY_FOR_REVIEW -> APPROVED -> RESERVED -> SCHEDULED -> DISPATCHING -> PARTIALLY_COMPLETED|COMPLETED|FAILED|CANCELLED`, separate recipient statuses.
- Social publication: `DRAFT -> APPROVED -> SCHEDULED -> PUBLISHING -> PUBLISHED|FAILED|REVIEW_REQUIRED|CANCELLED`.
- AI agent task: `QUEUED -> AUTHORIZED -> RUNNING -> OUTPUT_READY -> AWAITING_APPROVAL -> EXECUTING_ACTION -> SUCCEEDED|FAILED|CANCELLED`.
- Wallet reservation: `HELD -> PARTIALLY_SETTLED|SETTLED|RELEASED|EXPIRED`, with atomic transition and individual settlement entries.
- Commerce order: reuse existing `ServiceOrderStatus` and add payment/fulfillment projection rather than a second order state machine.
- Provider connections: `NOT_CONNECTED -> CONNECTING -> VERIFIED -> DEGRADED|REVOKED`.

## 6. Provider-event consistency

- Durable outbox row transactionally recorded with WebXXL domain change; delivery worker applies at least once; consumers dedupe.
- `providerMessageId`, `clientMessageId`, `recipientId`, `idempotencyKey` persisted before/after delivery as available; never retry a potentially delivered send without reconciling idempotency/status.
- Signed provider webhooks and sender event provenance are mandatory; callbacks may arrive duplicated/out of order.
- Chatwoot outbound events routed to WebXXL gateway; forbid direct user access to alternate native Twilio channels for billable traffic. If strict gateway enforcement cannot be achieved with selected Chatwoot edition/API channel, **block production sending and propose another integration** rather than silently bypass billing.
- Postiz content hash/version must match approved artifact; publishing job records exact target `accountId/channelId`, scheduled time, execution status and source URL/ID.
- Provider absence must result in a visible `NOT_CONFIGURED`, not fake completion.

## 7. OAuth and social identity rules

- A WebXXL managed **business social account connection** is distinct from an individual CRM contact's social handle. Postiz business channels sync to business/site configuration, not bulk import of followers.
- Incoming social DMs become CRM interactions only through supported, permissioned Chatwoot/social connectors; identity merges need verified provider IDs or reviewed linking.
- Google Analytics/GSC property access granted by owner through OAuth and mapped to individual `ManagedSite` and market. Revocation disables refresh and never exposes data to sibling sites.
- Secrets encrypted in dedicated secret storage; DB stores metadata/pointer and capability, never raw private token.

## 8. Required OpenAPI artifacts during implementation

Generate `openapi/webxxl-platform-v1.yaml` (or repository-approved location), `types` from source schemas, typed adapter mocks, Pact-like contract tests, provider webhook fixtures, request ID documentation, and a response/error matrix. This document is sufficient to scope the API but **not** a finished executable OpenAPI schema. Tests must ensure errors and tenant resolution behavior match this contract.
