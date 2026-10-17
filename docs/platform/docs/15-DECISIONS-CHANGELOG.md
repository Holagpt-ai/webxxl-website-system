# 15 — Architecture Decisions, Open Decisions and No-Downgrade Log

**Effective baseline:** 2026-10-17. Changes to this architecture require owner-approved amendment and semver bump in `README.md` and `01-MASTER-TAD.md`. Do not treat an engineering preference as an owner decision.

## Locked owner requirements (do not silently narrow)

| ID | Decision | Reason / consequences |
|---|---|---|
| ADR-001 | WebXXL is scalable/modular, with future features structurally anticipated | Avoid rebuilding after rollout; use module registry, entitlements, feature flags and service adapters |
| ADR-002 | Existing working customer portal remains authoritative UI baseline | Protect preview/version approvals, projects, customer operations and source data |
| ADR-003 | **v0.app owns ALL UI/UX**, public + customer/admin; Cursor all backend/security/integrations/Git/deploy logic; Vercel hosts web app | No overlapping file ownership, preserve tools and workflow |
| ADR-004 | Operating accounts/sites/CRM/AI configs independent; shared billing only with explicit group authorization | Ten independent sites + one group payer/credit wallet |
| ADR-005 | ABMED three siblings: Aesthetics, Physicians Group, Clinical Research under planned ABMED BillingGroup | One wallet 1,000→800→700→650 example; segregated contacts, sender/compliance and PHI |
| ADR-006 | Payment processor interchangeable; same parent payer buys subscriptions, domains, hosting, email, messaging top-ups and other services | Do not hardcode Stripe; distinguish money checkout from credit wallet |
| ADR-007 | FREE core CRM, segmentation/import/export/pipeline/360°, AI lead monitor; robust HubSpot-like operations target | Not just name/phone list; additional SMS/provider charges only where applicable |
| ADR-008 | Marketing Studio visibly branded FREE; AI creates landing-page drafts, ad creative, campaigns and SEO improvement deliverables | Included customer acquisition/retention product, still controlled by fair usage and publishing approval |
| ADR-009 | Postiz is existing but NOT yet fully activated; activation and customer-specific social/AI publishing part of build, FREE software feature | Extend existing stub, real OAuth/API verification and scheduling, not duplicated scheduler |
| ADR-010 | Local SEO and competitor intelligence included/FREE; Google connectors per website, honest measurements | GSC, GA4, GBP/Places and rank adapter; source-specific, no invented results |
| ADR-011 | Chatwoot preferred conversation infrastructure, centralized SMS/email provider account(s), WebXXL policy gateway | Customer subaccounts/senders, compliant consent and paid messaging wallet, no bypass |
| ADR-012 | Paperclip internal workforce candidate, Hatchet durable workflow candidate, Twenty CRM candidate; validate prior to production commitment | Reuse proven open-source services while protecting isolation/license/runtime quality |
| ADR-013 | AI agents can operate across dashboard **through constrained, auditable tools**; future customer-purchase AI marketplace structurally ready but gated | Ten independent agent configs, no unrestricted financial/deploy/PHI/outreach rights |
| ADR-014 | English + Spanish at launch, more locales later | Existing locale architecture, no EN-only new modules |
| ADR-015 | Large Cursor implementation batches and minimal scoped validation during build; comprehensive release gates later | Avoid excessive audits, maintain forward progress |
| ADR-016 | No unapproved downgrade, deletion of promised function, relabeling free as paid, or architecture substitution | Any constraint must be presented as a decision/upgrade path to owner |
| ADR-017 | ABMED Clinical sensitive communications and Resend email activation remain compliance/production gated | Build reusable architecture without derailing existing ABMED site delivery |

## Open decisions (must be resolved at the specified gate, not guessed)

| Open ID | Decision needed | Default until resolved |
|---|---|---|
| OPEN-001 | Who may use free CRM/Marketing Studio/SEO before paying for website: all signups, subscribers only, or hybrid? | Support both via entitlement schema; no live free prospect signup claim |
| OPEN-002 | Twenty CRM actual production selection vs EspoCRM/Corteza/native, and AGPL/enterprise/multiworkspace compliance | `CrmProvider` interface and staging POC only |
| OPEN-003 | Paperclip/Chatwoot/Postiz/Hatchet exact deployed versions, licenses, edition-dependent features and multi-tenant rights | Pinned sandbox and license review before production |
| OPEN-004 | Wallet package pricing, unit conversion, expiry/refund/chargeback and transfer terms | Ledger/rate version schema, test-only credits |
| OPEN-005 | Payment processor/MoR (Stripe/Paddle/Lemon Squeezy/other) and taxes | Provider-neutral checkout, no live charges |
| OPEN-006 | Domain/email/hosting vendors and fulfillment automation | Interface only; existing services continue |
| OPEN-007 | Twilio subaccount sender/legal registration mapping and live SMS compliance | Synthetic provider stub; no live campaigns |
| OPEN-008 | Resend/domain verified senders and regulated healthcare workflow vendor path | Non-PHI only; ABMED deferred contact activation retained |
| OPEN-009 | Hostinger VPS resources, Postiz app state, isolated service deployment and DNS subdomains | Infrastructure inventory, no co-location assumption |
| OPEN-010 | Google property ownership, GSC/GA4/GBP API approvals and rank provider | Connect only verified owned sites; use No Data otherwise |
| OPEN-011 | AI model and voice selection, human escalation, unit cost budgets and legally permitted outbound call classes | Bounded content/draft agents; outbound AI voice disabled |
| OPEN-012 | Free-service fair usage, marketing promises, customer terms | No hidden customer charge; operator quotas can be configured |
| OPEN-013 | How existing `abmed-account` projects move to three operational siblings safely | Preserve current objects and IDs until owner-approved migration |
| OPEN-014 | Exact canonical WebXXL production domain and future service subdomains | Preserve currently observed `www.webbxxl.com`; no DNS assumptions |
| OPEN-015 | Specific per-customer AI employee paid offerings if ever activated | Structurally ready, **disabled**, base marketing agents free |

## Semver and change request policy

`MAJOR` for owner-approved behavior/pricing/tenant/account identity changes; `MINOR` for adding promised capabilities and extension points; `PATCH` for non-semantic clarification and verified code-status correction. New feature flags are not a downgrade if complete future target remains documented and active existing functions remain. Before an owner asks to downgrade, a vendor limitation/expense leads to alternative provider evaluation, not silent deletion.

### Decision-request form

```
Change ID / Date / Requester:
TAD reference and existing approved capability:
Proposed amendment (exact old → new):
Why needed / licensing / compliance / cost:
Impacts on existing customer/production data:
Equal-or-better alternatives, including no-downgrade route:
API/schema/UI/acceptance implications:
Feature flag / migration / rollback:
Owner explicit APPROVED / REJECTED / PENDING:
TAD version after approval:
```

## Revision log

| Date | Version | Event |
|---|---|---|
| 2026-10-17 | 1.0.0 | Initial consolidated documentation deliverable derived from owner-approved project direction and focused GitHub main/screenshot review. Does not claim deployment or GitHub commit. |
