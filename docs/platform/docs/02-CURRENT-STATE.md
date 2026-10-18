# 02 — Verified Repository Baseline and Honest Status

**Inspection:** GitHub `main` on 2026-10-18. **DOC-00 merged:** `9b0886afc4b312450a589a6fa6768612312a2ef8` (PR #32). **FOUND-01 merged:** `68c5fde5345813899e2db34ac422a90cb5956f52` (PR #33). **INFRA-02 merged:** `7277f94bdceb064600315a702f77d3d29d66eaed` (PR #34). Production Vercel deployment and Supabase migration application remain separate gates.

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
| OPEN-001 | `core.crm` entitlement | **POLICY_UNRESOLVED** |

## COMMS-06 (2026-10-18) — unified communications backend; live Chatwoot/SMS/email OFF

| Area | Evidence | Honest status |
|---|---|---|
| Domain services | `lib/platform/comms/*`, `config/comms-backend.ts` | Tenant mapping, conversations, webhook ingest, policy engine, messaging gateway **preparation**, quotes/intents, opt-out prep — **Vitest (synthetic/mocked)** |
| Chatwoot adapter | `lib/platform/providers/chatwoot-conversation.ts`, `chatwoot-http.ts` | Application API paths per **developers.chatwoot.com**; pin **v4.18.0-ce** (INFRA-02 compose only); **no live instance verified** |
| Persistence | Prisma migration `20261018210000_comms06_foundation` | **Pending apply** (not production/staging) |
| API routes | `app/api/v1/communications/*` | Auth.js membership + feature flags default **false**; webhook route **503** until relay auth configured |
| Wallet / transport | `gateway-service.ts`, `quote-service.ts` | **No credit debit/reservation**; outbound dispatch **NOT_CONFIGURED** |
| OPEN-001 | `core.communications` entitlement | **POLICY_UNRESOLVED** (inbox software ≠ free SMS) |

## SOCIAL-04 (2026-10-18) — Marketing Studio backend; live Postiz publishing OFF

| Area | Evidence | Honest status |
|---|---|---|
| Domain services | `lib/platform/social/*`, `config/social-marketing.ts` | Campaign/revision/approval/scheduling gateway, quotas, marketing requests — **Vitest covered** |
| Postiz adapter | `lib/platform/providers/postiz-social.ts`, `postiz-http.ts` | Typed Public API (`/integrations`, `/posts`) per **docs.postiz.com**; reference app pin **v2.25.1**; **NOT_CONFIGURED** without credentials/flags |
| Persistence | Prisma migration `20261018170000_social04_marketing_studio` | **Pending apply** (not production/staging) |
| API routes | `app/api/v1/social/*` | Auth.js membership + backend flags; schedule/approve return **501/503** until pilot hydration |
| OPEN-001 eligibility | `lib/platform/entitlements.ts` | **POLICY_UNRESOLVED** — no silent enrollment change |
| Production | — | **No live posts**; `POSTIZ_LIVE_PUBLISHING_ENABLED=false` default; app.webbxxl.com untouched |

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
| Entitlements | `lib/platform/entitlements.ts`; catalog types in `lib/marketplace/catalog.ts` | FREE vs PAID classifications exist. Existing marketplace quote strings and historical order amounts are unchanged. OPEN-001 eligibility remains `UNRESOLVED` |
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

`lib/marketplace/catalog.ts` still advertises **SEO & local visibility as quoted monthly/project service**, **CRM & follow-up automation as custom quote**, and **Marketing & ad campaigns as quote per campaign**. FOUND-01 did **not** change those production-facing prices. A parallel entitlement catalog now classifies the approved FREE core services and paid website/SMS/hosting/domain/email offerings. Historical `ServiceOrder` quotes remain intact. OPEN-001 (free prospect eligibility) is still unresolved and configurable.

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
