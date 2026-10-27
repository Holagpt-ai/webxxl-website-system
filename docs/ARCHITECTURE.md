# WebXXL Architecture — Operational Map

Canonical specification: [`platform/docs/01-MASTER-TAD.md`](platform/docs/01-MASTER-TAD.md). This page is an index.

```text
Customer, admin, and public UI (Next.js App Router, EN/ES, Vercel; v0.app owns the views)
  └─ Auth.js, membership, entitlements, account and site context
       └─ WebXXL application (Cursor-owned APIs, domain rules, approvals)
            ├─ project, version, owner-content approval, DNS-cutover policy
            ├─ CRM, marketing, social, SEO, analytics, communications
            ├─ AI workforce tools and human review
            ├─ billing group, payer, wallet, metering, orders
            ├─ Prisma / PostgreSQL / Supabase
            └─ outbox and provider adapters
                 ├─ GSC, GA4, GBP, licensed rank provider
                 ├─ Postiz, Chatwoot, message transports
                 ├─ GitHub and Vercel
                 └─ isolated specialist services only after approval
```

`CustomerAccount` owns operational data. `BillingGroup` aggregates authorized payment. Approval of a website version is not approval to spend, publish, or cut DNS over. Each adapter keeps its own credentials and audit scope.

Source modules on `main` at `f315e897218a48bfac44a0d50724c91d32b6c9c9` (PR #51): `lib/platform/{analytics,commerce,comms,crm,customer-ai-workforce,marketing,seo,social,wallet,workflow,workforce}` and `app/api/v1/*`. Presence in that tree is MERGED source. See [`DATA_AND_SERVICES.md`](DATA_AND_SERVICES.md) before calling any of it activated.

Further contracts: [`03-DATA-MODEL`](platform/docs/03-DATA-MODEL.md), [`04-API-INTEGRATIONS`](platform/docs/04-API-INTEGRATIONS.md), [`07-CRM-COMMUNICATIONS`](platform/docs/07-CRM-COMMUNICATIONS.md), [`09-SEO-INTELLIGENCE`](platform/docs/09-SEO-INTELLIGENCE.md), [`10-BILLING-COMMERCE`](platform/docs/10-BILLING-COMMERCE.md), [`11-SECURITY-COMPLIANCE`](platform/docs/11-SECURITY-COMPLIANCE.md), [`12-INFRA-OPERATIONS`](platform/docs/12-INFRA-OPERATIONS.md).
