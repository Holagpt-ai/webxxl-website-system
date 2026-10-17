# WebXXL — Authoritative Platform Blueprint

**Document set:** WEBXXL-PLATFORM-TAD v1.0.0 · **Baseline date:** 2026-10-17 · **Status:** Owner-directed complete target architecture; documentation package **issued for final review**, new component implementation **not yet authorized**.  
**Canonical codebase to reconcile:** [`Holagpt-ai/webxxl-website-system`](https://github.com/Holagpt-ai/webxxl-website-system), `main` (inspected on 2026-10-17).  
**Actual portal reference:** `https://www.webbxxl.com/dashboard` (double `b` in observed domain). Brand: **WebXXL**.  
**UI baseline:** [privacy-redacted working customer dashboard screenshot, 2026-10-17](reference/webxxl-working-dashboard-2026-10-17.png) (Overview / ABMED Clinical Research).  
**Repository publication:** These files are a deliverable to be reviewed and committed to `docs/platform/` in WebXXL; creating this artifact **does not mean it was pushed to GitHub or deployed**.

## Vision and commercial policy

WebXXL is a scalable, multi-tenant website-subscription and managed-business-operations platform. Customers receive one login to manage website delivery, services, CRM, local SEO intelligence, AI marketing deliverables, social publishing, communications, and invoices. **The core CRM, Marketing Studio, social automation, local visibility reporting, AI-created landing pages, AI-produced campaign/ad creative and routine AI marketing assistants are included at $0 additional software fee.** WebXXL charges for website subscriptions, SMS usage and separately billable third-party services (hosting, domains, email, carrier charges, paid media, etc.), subject to published terms. Free does not mean unlimited vendor usage or unauthorized external spending. Customer-purchased AI employees remain **feature-flagged for a potential future commercial offering**, while included marketing agents stay free.

**Ten separate websites may have ten independent CRM environments and ten independently configured AI receptionists while using one expressly authorized parent-company billing wallet.** Each site/business retains independent contacts, messaging identities, consents, Chatwoot inboxes, social channels and operational permissions. The shared wallet covers approved usage; a separate **shared payer/billing profile** covers website subscriptions, domain orders, hosting, email, etc. Do not silently spend SMS credits on domain purchases.

### Non-negotiable delivery rules

1. **Never reduce, drop, substitute, downgrade, hide, or reprice an approved capability without explicit owner approval.** Phased delivery and feature flags are permitted only if the full target remains specified and traceable. Commercial or legal restrictions are disclosed as blockers, not hidden tradeoffs.
2. **Extend—not replace—the working dashboard**: Overview, Project, Owner Review, Sites, Files, Messages, Approvals, Requests, Support, Services, Infrastructure, Notifications, Notification Settings, plus immutable deployment approvals and separate domain cutover authorization.
3. **Tool/file ownership:** `v0.app` = **all UI/UX**, including customer/admin dashboard and public pages. `Cursor` = backend, Prisma/SQL, APIs, integrations, agents, security, tests, Git and deployment logic. `Vercel` = WebXXL app hosting. `Hostinger/Docker` = isolated services. **No overlapping file edits.**
4. **Source of truth:** WebXXL owns customer identity, authorization, consent, payer/wallet, entitlements, orders, audit and AI tool permissions. Specialist systems are replaceable adapters. Never grant a third-party AI agent raw unrestricted database, payment or provider credentials.
5. **Provider-neutral by design:** payment provider unspecified; Twilio/Resend/Chatwoot/Postiz/Paperclip/Twenty/Hatchet/ElevenLabs/LiveKit are chosen or candidate adapters, not schema ownership assumptions.
6. **No fabricated outcomes:** report measured SEO data and completed AI work only with actual data, source/time, evidence and current job state. If not connected, display `Not connected`, `Pending`, or `Unavailable`.
7. **Explicit legal gates:** social posting, outbound calls, SMS/email outreach, clinical/PHI processing, domain purchases and production publishing require applicable authorization and compliant providers.
8. **No surprise execution:** Cursor's first build batch follows an approved version of this specification; documents alone do not authorize production migrations, live sends or billing.

## Before **every** WebXXL build session

**Mandatory session-read gate:** Open and read `docs/00-SESSION-START.md` and `docs/01-MASTER-TAD.md` first, then the domain document(s) and `docs/15-DECISIONS-CHANGELOG.md`. Verify GitHub `main` and inspect relevant implemented code before claiming any feature works. In session replies, state the TAD version, current batch and what is **Implemented / Verified / Planned / Deferred / Blocked**. Never rely solely on an old conversation recap; bring this package into the new conversation or load it from GitHub after it has been committed.

## Document map

| Document | Purpose |
|---|---|
| [00-SESSION-START](docs/00-SESSION-START.md) | Required session checklist, change management, anti-drift rules |
| [01-MASTER-TAD](docs/01-MASTER-TAD.md) | Canonical product, functional and architecture contracts |
| [02-CURRENT-STATE](docs/02-CURRENT-STATE.md) | Code-verified baseline vs new/planned work |
| [03-DATA-MODEL](docs/03-DATA-MODEL.md) | ERD, entities, migration and integrity constraints |
| [04-API-INTEGRATIONS](docs/04-API-INTEGRATIONS.md) | API catalog, events, webhooks and adapter boundaries |
| [05-SITEMAP-WIREFRAMES](docs/05-SITEMAP-WIREFRAMES.md) | Existing UI preservation, proposed routes, desktop/mobile wireframes |
| [06-AI-WORKFORCE](docs/06-AI-WORKFORCE.md) | Agent orchestration, tool policy, autonomy, instance lifecycle |
| [07-CRM-COMMUNICATIONS](docs/07-CRM-COMMUNICATIONS.md) | Robust CRM, Chatwoot, contact timeline, consent, messaging, voice |
| [08-SOCIAL-MARKETING](docs/08-SOCIAL-MARKETING.md) | Postiz activation, social AI, landing pages, creative and approval |
| [09-SEO-INTELLIGENCE](docs/09-SEO-INTELLIGENCE.md) | Google analytics, rankings, local competitors, execution loop |
| [10-BILLING-COMMERCE](docs/10-BILLING-COMMERCE.md) | Group wallet, subscriptions, catalog, billing and reconciliation |
| [11-SECURITY-COMPLIANCE](docs/11-SECURITY-COMPLIANCE.md) | Access control, healthcare boundary, regulatory and operational policy |
| [12-INFRA-OPERATIONS](docs/12-INFRA-OPERATIONS.md) | Vercel, Hostinger, Docker, secrets, monitoring, backups and DR |
| [13-IMPLEMENTATION-ROADMAP](docs/13-IMPLEMENTATION-ROADMAP.md) | Dependency batches, roles, user prerequisites, deployment gates |
| [14-ACCEPTANCE-TESTS](docs/14-ACCEPTANCE-TESTS.md) | Executable end-to-end contract test matrix |
| [15-DECISIONS-CHANGELOG](docs/15-DECISIONS-CHANGELOG.md) | Approved decisions, unresolved choices, change controls |
| [16-PROVIDER-REGISTER](docs/16-PROVIDER-REGISTER.md) | External repo URLs, vendor evidence, licensing and activation checklist |
| [reference/CURSOR-KICKOFF](reference/CURSOR-KICKOFF.md) | First architecture reconnaissance and implementation prompt |

## Version/status semantics

- **Existing in source:** inspected file/code on the identified `main`; not automatically live-tested.
- **Verified in production:** separate real environment test/date/evidence, never inferred from source.
- **Target / planned:** documented target behavior only.
- **Candidate:** implementation subject to licensing, isolation, performance and integration proof of concept.
- **Deferred:** full specification retained, feature hidden or provider activation postponed.
- **Blocked:** missing approval, environment access, provider registration, compliance or a failing gate.

**Owner signoff required for scope reduction, pricing changes, new irreversible provider choice, PHI workflows, commercial multi-tenant licensing, payment activation and live outreach.**
