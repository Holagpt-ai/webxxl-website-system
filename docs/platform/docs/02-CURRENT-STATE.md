# 02 — Verified Repository Baseline and Honest Status

**Operational checkpoint 2026-10-29:** GitHub `main` is `2de0f7f3b7f8f80b7006d7f7b7b13c7866b3822b` (PR #65, CONTINUITY-02 **MERGED**). Owner-reported Vercel production deployment `dpl_Es1UxLoXgEHThHwNm2phiQN1icsb` is **READY** for that SHA (deployment evidence only). Batches 17A–21B are **MERGED** on `main`. OPEN-001 cohort **SUBSCRIBER_ONLY** is enforced via `lib/platform/open001/` (Batch **22A** hardening **open on branch**). Batch **21C** read-only staging preflight: no isolated staging DB identified; no duplicate infra provisioned. Production migrations, flags, and provider activation remain **UNVERIFIED**. Authenticated staging/customer acceptance is **NOT VERIFIED**.

Older module sections below may describe earlier October pull-request states as **historical notes**. Current index: `docs/PROJECT_MEMORY.md`, `docs/SESSION_HANDOFF.md`, and `docs/DEPLOYMENT_STATUS.md`.

**Inspection (historical):** GitHub `main` on 2026-10-18. **DOC-00 merged:** `9b0886afc4b312450a589a6fa6768612312a2ef8` (PR #32). **FOUND-01 merged:** `68c5fde5345813899e2db34ac422a90cb5956f52` (PR #33). **INFRA-02 merged:** `7277f94bdceb064600315a702f77d3d29d66eaed` (PR #34). Production Vercel deployment and Supabase migration application remain separate gates.

## FOUND-01 — merged on GitHub; production migration not applied from INFRA-02

| Area | Evidence | Honest status |
|---|---|---|
| Billing group / wallet / providers / AI tools | `lib/platform/**`, additive Prisma migration `20261017220000_found01_platform_identity` | **Merged to `main`**. **Production DB migration not applied** in this batch |
| Tests | `__tests__/platform/found01*.test.ts` | Present on `main`; not re-run as full CI gate in INFRA-02 |

## AGENT-03 (2026-10-18) — internal workforce backend; live execution OFF

| Area | Evidence | Honest status |
|---|---|---|
| Internal agents | `lib/platform/workforce/internal-agents.ts` (5 roles) | **Defined and unit-tested**; default **paused**, `liveExecutionEnabled=false` |
| Task / execution engine | `lib/platform/workforce/*`, Prisma migration `20261018130000_agent03_internal_workforce` | **In-memory engine + schema**; WebXXL-owned task IDs; synthetic provider default |
| Approvals / tools | `approval-service.ts`, `execution-gateway.ts`, `operator-auth.ts` | **AGENT-03A:** trusted human operator boundary; task AUTHORIZED only via service; tool grants with approval policy always verified |
| Budget / pause | `budget-service.ts`, `pause-service.ts`, `config/workforce.ts` | **AGENT-03A:** integer subunit validation, release preserves settled cost, UTC month period key; pause/resume requires trusted operator |
| History protection | Prisma `ON DELETE RESTRICT` on execution/tool-call/approval | Task rows cannot cascade-delete material workforce history (pending migration) |
| Paperclip adapter | `lib/platform/providers/paperclip-workforce.ts` | Pin **v2026.325.0** reference; returns **NOT_CONFIGURED** until live pilot; **Paperclip not running** |
| Production | — | **Not activated**; no LLM keys; no GitHub writes; UI unchanged (v0.app) |

## CRM-05 (2026-10-18) — account-owned CRM backend; external sync OFF

| Area | Evidence | Honest status |
|---|---|---|
| Native CRM | `lib/platform/crm/*`, `config/crm-backend.ts` | Contacts, companies, pipelines/deals, tasks, consent/suppression, timeline, segments, import/export prep — **Vitest covered (synthetic)** |
| Providers | `webxxl-native-crm.ts`, `twenty-crm.ts` (candidate) | Native **EXISTING_ADAPTER**; Twenty returns **NOT_CONFIGURED** until `CRM_EXTERNAL_SYNC_ENABLED` + workspace mapping |
| Persistence | Prisma migration `20261018190000_crm05_foundation` | **Pending apply** (not production/staging) |
| API routes | `app/api/v1/crm/*` | Auth.js membership + `CRM_BACKEND_ENABLED=false` default |
| SalesLead | `SalesLead`, `LeadActivity`, `saleslead-bridge.ts` | **Unchanged**; bridge candidates only — no bulk migration |
| OPEN-001 | `core.crm` entitlement | **SUBSCRIBER_ONLY** (Batch 21B) — policy resolved; account subscription proof at API gate |

## SEO-07 (2026-10-18) — Local SEO intelligence backend; live Google/crawl OFF

| Area | Evidence | Honest status |
|---|---|---|
| Domain services | `lib/platform/seo/*`, `config/seo-backend.ts` | Bounded crawl (SSRF guards), page inventory model, GSC adapter (mock transport), competitor market ranking, opportunity engine, dashboard DTO, sync-run prep — **Vitest (synthetic/mocked)** |
| Providers | `google-gsc-seo.ts`, `google-ga4-seo.ts`, `google-gbp-seo.ts`, `google-places-seo.ts` | GSC typed Search Analytics path; GA4/GBP **NOT_CONNECTED/NOT_SUPPORTED**; Places discovery stores **place_id only** contract |
| Persistence | Prisma migration `20261018230000_seo07_foundation` | **Pending apply** (not production/staging) |
| API routes | `app/api/v1/seo/*` | Auth.js membership + `SEO_BACKEND_ENABLED=false` default; scan prepare **does not live-crawl** when `SEO_CRAWLER_ENABLED=false` |
| OPEN-001 | `core.local-seo` entitlement | **SUBSCRIBER_ONLY** (Batch 21B) |
| Production | — | **No Google OAuth**, **no live GSC/Places**, **no production crawl**, **no AI SEO execution** |

## COMMS-06 (2026-10-18) — unified communications backend; live Chatwoot/SMS/email OFF

| Area | Evidence | Honest status |
|---|---|---|
| Domain services | `lib/platform/comms/*`, `config/comms-backend.ts` | Tenant mapping, conversations, webhook ingest, policy engine, messaging gateway **preparation**, quotes/intents, opt-out prep — **Vitest (synthetic/mocked)** |
| Chatwoot adapter | `lib/platform/providers/chatwoot-conversation.ts`, `chatwoot-http.ts` | Application API paths per **developers.chatwoot.com**; pin **v4.18.0-ce** (INFRA-02 compose only); **no live instance verified** |
| Persistence | Prisma migration `20261018210000_comms06_foundation` | **Pending apply** (not production/staging) |
| API routes | `app/api/v1/communications/*` | Auth.js membership + feature flags default **false**; webhook route **503** until relay auth configured |
| Wallet / transport | `gateway-service.ts`, `wallet-boundary.ts` (WALLET-09) | Durable reservation path **implemented but flag-disabled**; outbound dispatch **NOT_CONFIGURED** |
| OPEN-001 | `core.communications` entitlement | **SUBSCRIBER_ONLY** (Batch 21B; inbox software ≠ free SMS) |

**COMMS-06A (in PR #38):** Webhook relay auth binds `x-webxxl-chatwoot-timestamp` into HMAC; scoped `eventDedupeKey`; trusted receipt processor (`processCommsWebhookReceiptById`) — HTTP ingest leaves **PENDING** until worker activated; channel-aware timeline mapping; intent fingerprint conflicts; synthetic quotes gated by `COMMS_SYNTHETIC_QUOTE_ENABLED`.

## SOCIAL-04 (2026-10-18) — Marketing Studio backend; live Postiz publishing OFF

| Area | Evidence | Honest status |
|---|---|---|
| Domain services | `lib/platform/social/*`, `config/social-marketing.ts` | Campaign/revision/approval/scheduling gateway, quotas, marketing requests — **Vitest covered** |
| Postiz adapter | `lib/platform/providers/postiz-social.ts`, `postiz-http.ts` | Typed Public API (`/integrations`, `/posts`) per **docs.postiz.com**; reference app pin **v2.25.1**; **NOT_CONFIGURED** without credentials/flags |
| Persistence | Prisma migration `20261018170000_social04_marketing_studio` | **Pending apply** (not production/staging) |
| API routes | `app/api/v1/social/*` | Auth.js membership + backend flags; schedule/approve return **501/503** until pilot hydration |
| OPEN-001 eligibility | `lib/platform/open001/` + `lib/platform/entitlements.ts` | **RESOLVED** — `SUBSCRIBER_ONLY`; no silent enrollment change |
| Production | — | **No live posts**; `POSTIZ_LIVE_PUBLISHING_ENABLED=false` default; app.webbxxl.com untouched |

## MKT-08 (2026-10-18) — unified marketing preparation, CRM lead recovery; all execution OFF

| Area | Evidence | Honest status |
|---|---|---|
| Domain services | `lib/platform/marketing/*`, `config/mkt-backend.ts` | Durable **MarketingRequest** lifecycle, brand context versions, artifact revisions/reviews, SEO→landing handoff prep, lead follow-up evaluation, CRM task + COMMS draft handoff boundaries — **Vitest covered (mocked Prisma + pure logic)** |
| Persistence | Prisma migration `20261018240000_mkt08_foundation` | **Pending apply** (not production/staging). Extends SOCIAL-04 `MarketingRequest` / `MarketingArtifact`; does not replace CRM/social authorities |
| API routes | `app/api/v1/marketing/*` | Auth.js membership + permissions + OPEN-001 subscriber gate + `MKT_BACKEND_ENABLED`. **503 MKT_DISABLED** when flag off; **403 FREE_SOFTWARE_NOT_ELIGIBLE** when non-subscriber |
| Creative generation | `creative-generator.ts` | **DETERMINISTIC_DRAFT** only; `MKT_AI_GENERATION_ENABLED=false`; no live LLM attribution |
| Approvals | `MarketingArtifactReview` | Human-only decide path; revision hash binding; no publish/send/wallet |
| Lead monitor | `follow-up-evaluation-service.ts` | Coverage uses `CrmFollowUpCoverage` (+ summary `NOT_ELIGIBLE` for suppressions); **no outbound** SMS/email |
| Feature flags | `MKT_*` in `config/mkt-backend.ts` | All default **false**; does not enable SOCIAL/CRM/COMMS/SEO/workforce production flags |
| Production | — | **Not deployed**; no Postiz schedule, no ad spend, no site file writes |

**MKT-08A (in PR #40):** Follow-up task staff membership checks, timeline-based coverage (no `tasks.length` outreach proxy), atomic approval `updateMany`, SHA-256 request fingerprints, non-swallowed FSM transitions, brand `complianceReviewState` trust, tenant FK hardening in pending migration — **Vitest `mkt08a-integrity`**.

**MKT-08B (in PR #40):** Approval CAS rollback via transaction throw; `MarketingFollowUpTaskIntent` dedupe for callback concurrency; verified-sync-only coverage semantics; prepare workflow single-transaction (revision + revoke + `DRAFT_READY`) — **Vitest `mkt08b-merge-integrity`**.

## WALLET-09 (2026-10-18) — shared prepaid wallet + provider-neutral SMS/email foundation; live money/send OFF

| Area | Evidence | Honest status |
|---|---|---|
| Durable wallet engine | `lib/platform/wallet/durable-service.ts`, `balance.ts`, `spending-policy.ts` | **Prisma/PostgreSQL-oriented** reserve/settle/release/refund/reconcile with `FOR UPDATE` wallet lock + reservation CAS; FOUND-01 in-memory contract **preserved** for synthetic regression |
| Persistence | Prisma migration `20261018250000_wallet09_foundation` | **Pending apply** (not production/staging). Extends `CreditReservation`, `WalletLedgerEntry`, `SiteSpendingPolicy`, `CommunicationQuote`; adds rate plan, top-up quote, provider event receipt models |
| Rate / quotes | `rate-plan.ts`, `top-up-quote.ts` | Fixture SMS segment + email unit estimates; **COST_UNAVAILABLE** when missing; top-up quote **does not mint credits** without `WalletFundingEvidence` |
| Providers | `twilio-sms.ts`, `resend-email.ts`, `messaging-transport.ts` | Typed prepare/normalize contracts; **mock transport only**; `TWILIO_ADAPTER_ENABLED` / `RESEND_TRANSPORT_ENABLED` default **false** |
| COMMS linkage | `comms/wallet-boundary.ts`, `policy-engine.ts` tenant fix | Quote→reservation prep boundary; **no outbound dispatch**; wallet/comms integration flag default **false** |
| API routes | `app/api/v1/billing-groups/*`, `app/api/v1/wallet/*`, `wallet-topups/quote` | Auth.js + billing group roles; **`WALLET_BACKEND_ENABLED` / `WALLET_GROUP_READ_ENABLED` default false** |
| Tests | `__tests__/platform/wallet09-foundation.test.ts` | ABMED 1000→650 durable path via **in-memory Prisma simulator**; concurrent hold race; partial settle/release; provider replay idempotency. **Live PostgreSQL concurrency not verified** in CI |
| Production | — | **No Twilio/Resend live calls**, **no card checkout**, **no webhook settlement**, **no credit mint from quotes**, **no migration apply** |

**WALLET-09A (in PR #41):** Server-only `WalletMutationPrincipal` for durable mutations; synthetic TOP_UP restricted to Vitest + `WALLET_SYNTHETIC_FUNDING_ENABLED`; full reservation fingerprint replay; refund ledger integrity; timezone-aware spending caps; COMMS quote/intent binding; provider reconciliation fingerprints; usage API site ownership — **Vitest `wallet09a-integrity`**.

**WALLET-09B (in PR #41):** IANA timezone midnight for policy windows; scoped settle/refund/provider receipt idempotency (no global key-only replay); COMMS cost from quoted units (not `contentHash` as SMS body); durable operation feature gates + `WALLET_TEST_EXECUTION_BYPASS` (test-only); P2002 replay outside aborted transactions; top-up quote material fingerprint — **Vitest `wallet09b-integrity`**. Live PostgreSQL concurrency still **not** verified in CI.

**WALLET-09C (merged on main):** `WalletLedgerEntry.actorServiceId`; COMMS aggregate unit semantics; guarded reservation expiry; fractional IANA timezone midnights.

**AUTO-10 (PR #42):** PostgreSQL-backed `WorkflowJob` FSM, `PrismaWorkflowProvider` (`FOR UPDATE SKIP LOCKED` claim SQL), transactional outbox, retry/backoff, lease fencing, recovery/dead-letter repair hooks, safe handlers (COMMS receipt by id, marketing follow-up evaluate, SEO sync prepare), legacy notification delivery conditional claim, read APIs + gated `POST /api/automation/workflow-worker`. **Prisma-first** (see `docs/platform/docs/AUTO10-PROVIDER-DECISION.md`). All `WORKFLOW_*` flags default **OFF**. PostgreSQL claim concurrency **not verified** in CI without test DB. Vitest: `auto10-workflow.test.ts`, `auto10a-integrity.test.ts`.

**AUTO-10A (in PR #42):** CAS job transitions + fenced lease checks; fairness releases excess claims (no stranded `CLAIMED`); typed outbox envelope + `SKIP LOCKED` dispatch dedupe; worker attempt records + handler exception isolation; automatic expired-lease recovery without `WORKFLOW_REPAIR_ENABLED`; staff-gated platform workflow reads; handler tenant binding for COMMS/MKT/SEO; legacy notification expired-PROCESSING recovery.

**AUTO-10B (in PR #42):** Monotonic `WorkflowAttempt` lifecycle with abandoned-attempt finalization; crashed attempts count toward `maxAttempts`; external notification unknown outcomes quarantined (no auto-resend); outbox replay tenant/fingerprint validation + dispatch lease; unexpired lease required on worker completions; COMMS jobs require account-bound receipts; global concurrency admission documented as best-effort.

**AUTO-10C (in PR #42):** Transaction-scoped attempt abandonment (protects active lease); recovery abandons attempts + FSM in one transaction; durable outbox dispatch lease columns + expiry reclaim; NULL-safe notification claim filter; staff retry blocked for quarantined deliveries.

**AUTO-10D (in PR #42):** CAS-before-abandon ordering for attempt start and expired-lease recovery; outbox acknowledgment uses live clock (not batch `now`) with lease-valid finalize/fail CAS.

**ANALYTICS-14 (merged source):** Unified customer analytics and BI HTTP layer (`/api/v1/analytics/accounts/:id/*`) reusing SEO-07 connections/metrics/keywords/sync runs; additive conversion definition/event tables; provider adapters (GA4, GSC, GBP, rank vendor, WebXXL events); deterministic summaries without attribution claims. Backend PR #48 and dashboard PR #49 are on `main`. `ANALYTICS_BACKEND_ENABLED`, `ANALYTICS_INGESTION_ENABLED`, and `ANALYTICS_FIRST_PARTY_CAPTURE_ENABLED` default **OFF** in `config/analytics-backend.ts`. `features.analyticsBackend` is `false`. Contract: `docs/platform/docs/ANALYTICS-14-API-CONTRACT.md`.

**ANALYTICS-15 (merged source, PR #51, `f315e897218a48bfac44a0d50724c91d32b6c9c9`):** First-party signed capture API (`POST /api/v1/analytics/capture/events`), UTC daily conversion aggregation into `AnalyticsConversionObservation`, bounded provider sync worker (`POST /api/v1/analytics/sync/worker`), SEO-07 metric/keyword persistence helpers, AUTO-10 handlers `ANALYTICS_PROVIDER_SYNC` and `ANALYTICS_CONVERSION_AGGREGATE`. Migrations `20261025120000_analytics15_ingestion` and `20261025180000_analytics151_rate_limit` are in Git only. Live Google fetch requires `ANALYTICS_PROVIDER_FETCH_ENABLED` and `WORKFLOW_EXTERNAL_EFFECTS_ENABLED` (source default off). **Merged in source. Not activated.** Production migration level **UNVERIFIED** for analytics14 and analytics15.

## INFRA-02 (2026-10-18) — repository infrastructure only; live staging BLOCKED

| Area | Evidence | Honest status |
|---|---|---|
| Isolated service compose | `infra/services/{chatwoot,postiz,paperclip,shared,scripts}/**` | **Deployment-ready staging definitions** with pinned upstream references; **not executed** on Hostinger |
| VPS inventory | `infra/services/shared/inventory-2026-10-18.md` | Hostinger capacity **unknown**; no SSH/hPanel access from Cursor |
| Postiz existing URL | `https://app.webbxxl.com` probed read-only | **Postiz UI confirmed**; version/social links **not verified**; **not reinstalled** |
| Integration contracts | `lib/platform/integrations/isolated-services.ts`, `chatwoot-account-mapping.ts`, `lib/integrations/postiz-discovery.ts` | Staging endpoint registry + tenant mapping rules; providers remain **NOT_ACTIVATED** |
| Chatwoot / Paperclip / Postiz staging | Compose/overlays + scripts | **Not live** until owner approves isolated host + `WEBXXL_STAGING_CONFIRM` |

## FOUND-01 historical branch note (pre-merge documentation snapshot)

| Area | Evidence | Honest status |
|---|---|---|
| Billing group identity | `prisma/schema.prisma` models `BillingGroup`, `BillingGroupMembership`, `BillingGroupRole`, `BillingProfile`, `SiteSpendingPolicy` | **Implemented in source** on `feature/webxxl-found-01`. Additive migration `20261017220000_found01_platform_identity` is **not applied** to production |
| Shared wallet contracts | `lib/platform/wallet/*` plus Prisma `CreditWallet`, `WalletLedgerEntry`, `CreditReservation`, `MessageUsage` | **Contract + synthetic engine implemented and unit-tested**. FOUND-01A corrected partial holds, amount validation, actor authorization, funding uniqueness, and restrictive financial FK deletes. FOUND-01B rejects caller-forged `SERVICE` actors (server registry only), validates membership activation before mutate, and blocks expired reservation create/settle paths. No live top-up, Twilio send, or payment execution |
| Authorization split | `lib/platform/billing-authz.ts`, `lib/platform/account-isolation.ts` | Group billing rights are independent of `CustomerMembership` / CRM access. Existing Auth.js and `lib/portal/authz.ts` unchanged |
| Entitlements | `lib/platform/entitlements.ts`; `lib/platform/open001/`; catalog types in `lib/marketplace/catalog.ts` | FREE vs PAID classifications exist. Marketplace quotes unchanged. OPEN-001 **SUBSCRIBER_ONLY** (2026-10-29) on `main` @ `c6d122` |
| Provider registry | `lib/platform/providers/*` | Typed replaceable interfaces. Existing Postiz stub, Resend email, worker, and billing identifiers are wrapped. Twenty, Chatwoot, Paperclip, Twilio, and payment processors are **not installed** |
| AI tool registry | `lib/platform/ai-tools/*` | Deny-by-default contracts only. No autonomous agents activated. `purchasableAiEmployees` flag is `false` |
| ABMED data | `lib/platform/fixtures/abmed.ts` | Synthetic test identities only. Live `abmed-account` memberships, projects, and approvals were **not migrated** |
| Production / Vercel | none | **Not deployed**. Dashboard UI unchanged |

## Existing source facts that must be reused

| Area | Inspectable source/evidence | Status / meaning |
|---|---|---|
| Next.js App Router, EN/ES | `app/[locale]/dashboard/*` | Existing in source; preserve actual locale route behavior |
| Auth.js / Prisma / PostgreSQL | `auth.ts`, `prisma/schema.prisma`, `lib/portal/authz.ts` | Existing in source, no Supabase Auth migration |
| Customer account membership selector | `app/[locale]/dashboard/layout.tsx`, `lib/portal/active-customer-account.ts` | Existing authenticated account selection; server membership check |
| Project selector | `app/[locale]/dashboard/layout.tsx`, `lib/portal/active-project.ts` | Separate from customer account and payer context |
| Dashboard | `app/[locale]/dashboard/page.tsx`, `components/dashboard/*` | Website preview, progress, action items, approvals, activity |
| Version/owner review | `docs/owner-review-package.md`, `docs/batch30-project-delivery-checklist.md` | Existing immutable preview approval and separate owner review; do not conflate with domain cutover |
| Module registry | `lib/portal/modules.ts`, `config/features.ts` | Existing service and navigation module pattern |
| Service marketplace | `app/[locale]/dashboard/services/page.tsx`, `lib/marketplace/{catalog,billing,orders,queries}.ts` | Existing service orders/entitlements; payments not fully implemented |
| Existing source schema | `prisma/schema.prisma` | Original inspection: 38 models, including CustomerAccount, CustomerMembership, Project, ManagedSite, SalesLead, LeadActivity, ServiceOrder, CustomerService, AutomationEvent and AutomationDeliveryJob. FOUND-01 **extends** this schema additively; existing models remain |
| Site changes | `ManagedSite`, `ManagedSiteCapability`, `ManagedSiteChange` | Existing website change and approval primitives |
| Internal automation | `lib/automation/worker.ts`, `AutomationEvent`, `AutomationDeliveryJob` | Existing notification event/delivery system; SMS/WhatsApp disabled in inspected config |
| Postiz connector | `lib/integrations/scheduler.ts` | URL default `https://app.webbxxl.com`, HEAD availability checker, link-out; **stats returns null even if token configured** |
| WebXXL provider-neutral billing hook | `lib/integrations/billing.ts`; `lib/marketplace/billing.ts` | `stripe`, `paddle`, `lemon_squeezy`, `manual`, `none` are identifiers; no payment processor selected |
| Service feature flags | `config/features.ts` | `crmMarketing: true` is public marketing flag, while `aiServices: false`, `automationSmsChannel:false`, `automationWhatsappChannel:false`; `serviceMarketplace:true` |

## Known source/policy mismatch — resolve without deleting orders

`lib/marketplace/catalog.ts` still advertises **SEO & local visibility as quoted monthly/project service**, **CRM & follow-up automation as custom quote**, and **Marketing & ad campaigns as quote per campaign**. FOUND-01 did **not** change those production-facing prices. A parallel entitlement catalog now classifies the approved FREE core services and paid website/SMS/hosting/domain/email offerings. Historical `ServiceOrder` quotes remain intact. OPEN-001 (free prospect eligibility) is **resolved** as **SUBSCRIBER_ONLY** on `main` @ `c6d122`; `ALL_SIGNUPS` / `HYBRID` remain inactive future options.

## Existing role nuance

`User.role` includes `CUSTOMER`, `STAFF`, `ADMIN`; `CustomerMembership.role` has `OWNER`, `MEMBER`. Current `requireCustomerMembership()` selects authorized account from cookie-backed memberships. FOUND-01 adds separate `BillingGroupRole` contracts (`GROUP_OWNER`, `BILLING_ADMIN`, `BILLING_VIEWER`). Those roles do **not** grant sibling CRM access. Staff/admin should continue to use distinct server-side capabilities. Do not assert database RLS protects Prisma server activity without independently verifying it.

## Existing launch commitments to preserve

- ABMED Clinical Research site redesign and preview review remain in progress; screenshot shows 45% progress and pending approvals (snapshot, not a live DB assertion).
- Historic README/checklists: `docs/batch29-launch-prerequisites.md`, `docs/batch30-project-delivery-checklist.md`, `docs/owner-review-package.md`.
- ABMED Resend transactional activation was deferred to production cleanup; the new centralized messaging architecture **must not block** that existing rollout.
- Site source/deploy preview approval **does not imply DNS/domain migration permission**.
- Do not presume that all three ABMED sister sites already have provisioned independent accounts. Target structure is three accounts in one BillingGroup, but actual migration must reconcile live memberships and projects.

## Not verified / not yet built as a completed module

- Paperclip instance and five internal agents — planned only.
- Twenty CRM multi-workspace trial, CRM source-of-truth decision — candidate only.
- Chatwoot tenant inboxes — planned.
- Hatchet durable jobs — candidate; existing notification jobs remain live code.
- Live Postiz-to-WebXXL authenticated tenant API, approved posting workflows and analytics — **not implemented in inspected scheduler adapter**; Postiz external deployment state not independently checked here.
- Twilio ISV/subaccount onboarding, centralized SMS send, A2P compliance, consent; shared group wallet and payments — planned.
- GA4, Search Console, Business Profile and local competitor provider connections — planned.
- Future purchasable AI employees and regulated voice calling — disabled/conditional.

## First reconciliation before migrations

Cursor must inspect complete `prisma/schema.prisma` and relevant migrations for existing entity naming, request ID semantics and historical order invariants. Map desired entities onto existing `CustomerAccount`, `ManagedSite`, `SalesLead`, `LeadActivity`, `CustomerService`, `ServiceOrder`, `AutomationEvent` and `ProjectActivity`, recording **reuse / extend / new** for each. Query actual live environment only with authorized read access, with no production writes from the documentation phase. Confirm exact production host and Vercel project; `webxxl.com` (brand) and `www.webbxxl.com` (observed URL) must not be silently normalized.
