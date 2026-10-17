# 02 — Verified Repository Baseline and Honest Status

**Inspection:** GitHub connector read of `Holagpt-ai/webxxl-website-system`, default branch `main`, on 2026-10-17. Repository tree SHA as observed: `3a5ba5dc137b26f712d0e95eced8ead39dab4996` (**tree SHA, not commit SHA**). This was a focused source inspection, **not a build/deployment inspection or exhaustive branch audit**. A separate historical `feature/client-dashboard` branch exists, but **main** is the authoritative starting point. Observed dashboard screenshot supplied by owner (2026-10-17) depicts the current working customer Overview.

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
| Existing source schema | `prisma/schema.prisma` | 38 inspected Prisma models, including CustomerAccount, CustomerMembership, Project, ManagedSite, SalesLead, LeadActivity, ServiceOrder, CustomerService, AutomationEvent and AutomationDeliveryJob |
| Site changes | `ManagedSite`, `ManagedSiteCapability`, `ManagedSiteChange` | Existing website change and approval primitives |
| Internal automation | `lib/automation/worker.ts`, `AutomationEvent`, `AutomationDeliveryJob` | Existing notification event/delivery system; SMS/WhatsApp disabled in inspected config |
| Postiz connector | `lib/integrations/scheduler.ts` | URL default `https://app.webbxxl.com`, HEAD availability checker, link-out; **stats returns null even if token configured** |
| WebXXL provider-neutral billing hook | `lib/integrations/billing.ts`; `lib/marketplace/billing.ts` | `stripe`, `paddle`, `lemon_squeezy`, `manual`, `none` are identifiers; no payment processor selected |
| Service feature flags | `config/features.ts` | `crmMarketing: true` is public marketing flag, while `aiServices: false`, `automationSmsChannel:false`, `automationWhatsappChannel:false`; `serviceMarketplace:true` |

## Known source/policy mismatch — resolve without deleting orders

`lib/marketplace/catalog.ts` currently advertises **SEO & local visibility as quoted monthly/project service**, **CRM & follow-up automation as custom quote**, and **Marketing & ad campaigns as quote per campaign**. Approved future policy is that the **core CRM, local SEO visibility, AI marketing production, landing-page drafts, social automation and creative generation are FREE/included**, with website subscriptions, SMS and separate third-party services paid. The implementation must reclassify **future offers** and add free entitlements without retroactively altering historical contract/order records. If an advanced paid service outside the free core is contemplated, the owner must approve its exact scope and pricing first.

## Existing role nuance

`User.role` includes `CUSTOMER`, `STAFF`, `ADMIN`; `CustomerMembership.role` has `OWNER`, `MEMBER`. Current `requireCustomerMembership()` selects authorized account from cookie-backed memberships. Group-wallet rights **do not exist by implication** and must be modeled separately; staff/admin should use distinct server-side capabilities. Do not assert database RLS protects Prisma server activity without independently verifying it.

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
