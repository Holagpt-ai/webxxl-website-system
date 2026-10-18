# 02 — Verified Repository Baseline and Honest Status

**Inspection:** GitHub connector read of `Holagpt-ai/webxxl-website-system`, default branch `main`, on 2026-10-17. Original documentation inspection tree SHA: `3a5ba5dc137b26f712d0e95eced8ead39dab4996` (**tree SHA, not commit SHA**). **Authoritative `main` after DOC-00:** commit `9b0886afc4b312450a589a6fa6768612312a2ef8` (PR #32, TAD v1.0.0). This was a focused source inspection, **not a build/deployment inspection or exhaustive branch audit**. A separate historical `feature/client-dashboard` branch exists, but **main** is the authoritative starting point. Observed dashboard screenshot supplied by owner (2026-10-17) depicts the current working customer Overview.

## FOUND-01 source update (2026-10-17) — implemented in branch, not merged or deployed

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
