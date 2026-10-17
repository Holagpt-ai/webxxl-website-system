# 05 — Portal Sitemap, UX Contracts and Text Wireframes

**Design owner:** **v0.app exclusively** (all WebXXL UI/UX). **Backend owner:** Cursor. **Hosting:** Vercel. **Status:** proposed extension; screenshot of customer Overview on 2026-10-17 is the **visual baseline**. Do not refactor existing UI in a backend sprint. All new screens EN/ES and responsive, with keyboard focus, semantic landmarks, mobile drawer and honest empty/pending/connection states.

## A. Existing baseline — PRESERVE

**Visual reference:** [Owner-supplied production dashboard screenshot (email redacted), 2026-10-17](../reference/webxxl-working-dashboard-2026-10-17.png). This image is a protected baseline for UI preservation, not a mockup or permission to redesign.

Current customer shell (owner screenshot): WebXXL header, business label `ABMED`, **Project** selector; navigation `Overview`, `Project`, `Owner review`, `Sites`, `Files`, `Messages`, `Approvals`, `Requests`, `Support`, `Services`, `Infrastructure`, `Notifications`, `Notification settings`. Overview contains **WEBSITE PREVIEW** (active immutable version), Open website, Open public alias, status, source revision/deployment, optional approval note, Approve version / Request changes; PROGRESS (45% screenshot example); ACTION ITEMS; AWAITING YOUR APPROVAL; RECENT ACTIVITY. **Do not move or replace this established workflow while adding marketing modules.**

Existing route `/[locale]/dashboard` (locale convention: `/dashboard` English, `/es/dashboard` Spanish) and existing route files must be preserved. Existing customer account switch and project selector are **distinct**. BillingGroup wallet is a third context, not a new project selector.

## B. Target context selectors

```
┌────────────────────── WebXXL CUSTOMER SHELL ────────────────────────────┐
│ WebXXL      Business: [ABMED Aesthetics ▾]   Site: [Aesthetics ▾]     │
│             Project: [Redesign ▾]            Wallet: ABMED [650 cr]    │
│ Notifications  EN / ES   Team  Profile                                 │
└───────────────────────────────────────────────────────────────────────┘
```

Rules: business selector lists **only authorized CustomerMemberships**; site/project selector lists only assets of active business; wallet group label/balance shown only if actor has group balance visibility, otherwise a permitted account-level allowance summary. Group switch does not confer new CRM access. A customer may have many sites per CustomerAccount. All selectors validated server-side; cookies are UI preferences, never authorization.

## C. Target customer sitemap (retain existing routes)

```text
/[locale]/dashboard
├── overview (EXISTING - keep preview, action items, approvals, activity)
├── project                 (EXISTING)
├── review                  (EXISTING conditional Owner review)
├── sites                   (EXISTING; add site-specific SEO/agent links)
├── files                   (EXISTING)
├── messages                (EXISTING project messages)
├── approvals               (EXISTING; add typed agent/artifact approvals only via compatible service)
├── requests                (EXISTING)
├── support                 (EXISTING)
├── services                (EXISTING marketplace and orders; show FREE inclusions)
├── infrastructure          (EXISTING)
├── notifications           (EXISTING)
├── settings/notifications  (EXISTING)
├── marketing               (NEW — Marketing Studio, prominent FREE badge)
│   ├── requests            (landing-page, campaign and ad creative requests)
│   ├── deliverables        (versions, review, revisions, asset links)
│   ├── campaigns           (cross-channel marketing plan status)
│   └── approvals           (marketing-specific filtered view, not duplicate approval engine)
├── crm                     (NEW — robust FREE CRM)
│   ├── contacts            (search, list, segments, bulk, import/export)
│   │   └── [contactId]     (360° contact and activity timeline)
│   ├── companies          (organization and related contacts)
│   ├── leads               (saved views and opportunities)
│   ├── pipeline            (deals and customizable stages)
│   ├── tasks               (overdue, owner, SLA, follow-up)
│   ├── segments            (saved static/dynamic filtered sets)
│   └── settings            (custom fields, ownership, sync, imports)
├── communications          (NEW — Chatwoot backed)
│   ├── inbox               (conversations, human/AI handoff)
│   ├── campaigns           (SMS/email campaign creation)
│   │   └── [campaignId]    (estimate, consent, approval, delivery)
│   ├── senders             (domains, SMS numbers, A2P states)
│   └── history             (delivery, opt-outs, channel audit)
├── social                  (NEW — Postiz backed FREE)
│   ├── calendar            (scheduled/published posts)
│   ├── campaigns           (AI planning, approval and scheduling)
│   ├── channels            (connected business social accounts)
│   └── analytics           (real post/channel results)
├── seo                     (NEW — FREE local SEO intelligence)
│   ├── overview            (SEO snapshots, last source refresh)
│   ├── pages               (inventory, indexing, fixes, created pages)
│   ├── keywords            (GSC impressions/clicks/position)
│   ├── local-market        (market selector, competitors, verified grid ranks)
│   ├── opportunities       (AI prioritization, proposed changes)
│   └── connections         (GSC, GA4, GBP, rank providers)
├── ai-employees            (NEW account-scoped configuration; commercial store deferred)
│   ├── instances           (included marketing employees and future configurations)
│   ├── [instanceId]        (knowledge, policies, channels, usage, escalations)
│   └── activity            (traces, requests, approvals)
├── automations             (NEW — tasks, policies, runs and failure review)
├── wallet                  (NEW — group wallet, if authorized)
│   ├── transactions        (group/account/site attribution)
│   └── top-up              (provider-neutral checkout)
├── billing                 (NEW — orders, subscriptions, invoices, methods)
└── settings               (EXISTING where applicable; ADD scoped panels)
    ├── team                (account membership)
    ├── integrations        (connections and OAuth)
    ├── messaging           (sender/consent/compliance settings)
    ├── social              (authorized social connections)
    └── group-billing       (group members, payer, site caps)
```

Path names are **proposed**; Cursor must reconcile current file routing before implementation. Avoid duplicate `messages` vs `communications/inbox`: former is project communication; latter contact conversation. Navigation can group Marketing Studio, CRM, Social and SEO together; **do not bury FREE Marketing Studio** behind a paid services page. Feature flags hide unfinished modules; server authorization always enforced.

## D. Target staff/admin sitemap

```text
/[locale]/admin  [preserve current admin project/approval routes]
├── executive-operations
├── customer-accounts / business-groups / memberships
├── projects / previews / approval history / domain-cutover approvals
├── services / orders / provisioning
├── crm-support [only authorized scopes]
├── workforce / agent-directory / agent-tasks / approvals / cost
├── marketing-deliverables / review-queue
├── communications / sender-compliance / deliverability / suppression
├── social-operations / postiz-connections / failed-publications
├── seo-operations / connection-health / crawl-queue / provider-usage
├── billing-groups / wallets / adjustments / orders / invoices
├── provider-integrations / credentials-health / sync-errors
├── automation-jobs / dead-letter / replay-authorizations
├── infrastructure / deployments / backups / alerts
└── audit / policies / feature-flags
```

Staff view must not casually expose PHI, raw provider credentials or all tenant records by default; least privilege applies to administrators, too.

## E. Desktop wireframes (normative behavior, illustrative figures)

### E1 — Customer Overview: keep and add compact modular strip

```text
┌─Side nav (existing)─┬───────────────────────────── Overview ───────────────────────────┐
│ WebXXL             │ ABMED Clinical Research • Website Redesign                        │
│ Project selector   │ ┌─ WEBSITE PREVIEW (existing, unchanged) ────────────────────────┐ │
│ Overview  ◉        │ │ real deployed preview, version ID, approve/request changes     │ │
│ Project            │ └─────────────────────────────────────────────────────────────────┘ │
│ Owner review       │ ┌─ PROGRESS 45% ─┐ ┌─ YOUR ACTION ITEMS ────────────────────────┐ │
│ Sites / Files      │ └────────────────┘ └───────────────────────────────────────────┘ │
│ Messages / ...     │ ┌─ AWAITING APPROVAL ─┐ ┌─ RECENT ACTIVITY ─────────────────────┐ │
│ Services           │ └────────────────────┘ └───────────────────────────────────────┘ │
│ ─── NEW, FLAGGED   │ ┌─ Free Marketing Studio ─── [ FREE ] ──────────────────────────┐ │
│ Marketing Studio   │ │ AI deliverables awaiting review | SEO work | Social plan      │ │
│ CRM / Social       │ └───────────────────────────────────────────────────────────────┘ │
│ Local SEO          │ ┌─ Shared wallet / site visibility summary (permission gated) ─┐ │
└────────────────────┴───────────────────────────────────────────────────────────────────┘
```

No existing approval CTA is displaced by the marketing panel. Empty/new module strip hidden until applicable if desired; no fake metrics.

### E2 — Marketing Studio (FREE persistent badge)

```text
┌ Marketing Studio                                       [ FREE ] ──────────────────┐
│ Business [ABMED Aesthetics ▾]  Site [ ... ▾]   [New Request]                 │
│ [Landing Page] [Social Campaign] [Ad Creative] [Local SEO Improvement]      │
│ ┌ AI Work Queue ────────────────┐ ┌ Deliverables Awaiting Approval ──────┐ │
│ │ task / owner / due / evidence │ │ title, revision, reviewer, approve   │ │
│ └───────────────────────────────┘ └──────────────────────────────────────┘ │
│ [Calendar / scheduled campaigns] [Publishing status and analytics]         │
│ [Recent agent actions / actual costs to WebXXL / available free limits]    │
└─────────────────────────────────────────────────────────────────────────────┘
```

Free does not falsely imply free ad platform spend or unlimited paid API volume. Request form captures goal, audience, locales, platforms, references, market, legal constraints, published site, requested dates, attachments. Artifacts have revision, source, per-site ownership and explicit approval.

### E3 — Robust CRM list and filters

```text
┌ CRM                                  [ FREE ] ────────────────────────────────┐
│ [All Contacts] [Companies] [Pipeline] [Tasks] [Segments]                     │
│ Search ...   [Advanced Filters ▾] [Saved Views ▾] [Import] [Export] [Add]     │
│ Cards: New leads | Never contacted | Overdue | No campaign | Waiting reply    │
│ Name    Company    Channels  Owner  Source  Stage  Last inbound  Last reply    │
│ ...     ...        ☎✉✦       ...    ...     ...    ...           ...           │
│ Multi-select -> assign/tag/add to segment/prepare outreach (consent gated)   │
│ Smart list builder: AND/OR filters; sort; coverage dates and saved defaults   │
└───────────────────────────────────────────────────────────────────────────────┘
```

Core fields: name(s), organization(s), addresses, multi-number/email, role, source, channel identities, tags, custom fields, status, pipeline, owner, score/explanation, consent indicators, communication preferences, created/source timestamps, last inbound/outbound, next follow-up, campaign eligibility, notes, attachment references. Import CSV mapping preview/dedupe/consent policy; exports role-gated and audited.

### E4 — Contact 360° / AI follow-up

```text
┌ CRM / Contact · Alex Morgan ──────────────────────────────────────────────────┐
│ Identity / connected channels / business / owner / lead source               │
│ Consent pills: SMS marketing? email marketing? AI voice? (evidence link)      │
│ [Chat] [SMS] [Email] [Call] [Task] — only permitted actions enabled           │
│ ┌ Omnichannel timeline ──────────────┐ ┌ Opportunity / Follow-up ───────────┐ │
│ │ website form, phone, chat, notes,  │ │ lead age, pipeline, overdue,      │ │
│ │ sent/delivered/replied/opt-out,    │ │ AI suggestion, evidence/coverage, │ │
│ │ social DM, campaigns and AI tasks  │ │ draft for human approval          │ │
│ └────────────────────────────────────┘ └────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────┘
```

If integrations do not cover phone conversations, label 'No **recorded** outreach in connected systems' rather than 'Never called'. AI cannot call without lawful consent and voice-policy gate.

### E5 — Social / Postiz

```text
┌ Social Media                            [ FREE ] ────────────────────────────┐
│ [Connections] [Campaigns] [Calendar] [Performance]                           │
│ [Connected: FB] [IG disconnected] [LinkedIn pending] [Connect channel]         │
│ Campaign: brief → AI draft posts/creatives → preview by channel               │
│ Calendar [month/week]  statuses: Draft / Review / Approved / Scheduled / Live  │
│ [Approval of exact version + budget] [Schedule approved content in Postiz]    │
│ Actual post URLs | failure and retry controls | measured metrics/time/source   │
└───────────────────────────────────────────────────────────────────────────────┘
```

### E6 — Local SEO & Competitor Intelligence

```text
┌ Local SEO                              [ FREE ] ──────────────────────────────┐
│ Site + market/geo selector     [GSC Connected?] [GA4?] [GBP?] [Last sync]      │
│ Cards: Published pages | Organic clicks | Impressions | GSC average position  │
│ Trend (source + date) | Top queries / URLs | Index status | technical issues  │
│ Competitors: name/category/location/reviews [Places source]                   │
│ Local keyword position only if actual geo/keyword rank provider connected    │
│ AI improvement queue: proposed page/fix → review → PR/publish → outcome        │
└───────────────────────────────────────────────────────────────────────────────┘
```

Never claim one absolute 'your position' across all searches without geo, query, device, source and date qualifiers.

### E7 — Group Wallet & Commerce

```text
┌ Wallet & Billing — ABMED Group ────────────────────────────────────────────────┐
│ [Group billing access validated]  Available 650 | Held 0 | Posted 650         │
│ [Top up] [Transactions] [Group members] [Usage caps] [Orders] [Invoices]       │
│ Aesthetics       200 credits | Physicians 100 | Clinical 50                    │
│ Credit ledger: each entry/site/channel/quantity/priceVersion/refund/status   │
│ Checkout: pay for WEBSITE SUB, DOMAIN, EMAIL, HOSTING with SAME payer;        │
│ do NOT deduct SMS wallet credits unless explicitly approved SKU policy        │
└───────────────────────────────────────────────────────────────────────────────┘
```

Only group billing owner/admin can change payer, members, limits or top-up; sibling CRM access never inferred. Add credit spending bars, cost filters, invoice previews, estimate and error states.

### E8 — AI employee configuration (included operational agent + future paid SKU)

```text
┌ AI Employees ───────────────────────────────────────────────────────────────────┐
│ Business / Site selector   [Existing Agents] [Future Store - disabled flag]     │
│ Agent: ABMED Physicians AI Receptionist  [Paused/Active] [Included or SKU]     │
│ Business Knowledge | Channels | Work hours | Allowed tools | Restricted tools │
│ Escalation to Dee/staff | Languages EN/ES | Consent policy | Monthly budget    │
│ Logs, actual completed tasks, audits, cost and manual override                │
│ [Test in sandbox] [Request approval] [Enable per-site]                        │
└────────────────────────────────────────────────────────────────────────────────┘
```

## F. Mobile rules

- Preserve project preview access and existing approval action prominence; stack panels vertically, sticky current-account context and clear switch selectors.
- Show one FREE badge at the Marketing Studio title; avoid duplicating green badges across each service.
- CRM lists become search/filter row + contact cards; details show channels, status, consent and last touch before action buttons.
- Campaign approval/delivery must fit mobile review with text preview and recipient counts; avoid enabling send merely because modal closed.
- Group wallet shows available, reserved, group name and transaction history on mobile; credit/top-up confirmation requires explicit step.
- Social calendar offers agenda view with pending vs published states. SEO charts may use scrollable/stacked charts but cannot clip source labels or metric qualifiers.
- EN/ES copy and dynamic long business names must be robust; WCAG AA targets, keyboard navigation, focus order, loading, error and no-data states.

## G. UX state dictionary

`NOT_ENABLED` module not rolled out; `NOT_CONNECTED` authorized provider not connected; `PENDING_APPROVAL` review required; `READY_TO_SCHEDULE` exact artifact approved; `SCHEDULED` external provider confirmed schedule; `PUBLISHED` external post URL/time confirmed; `DELIVERY_PENDING` carrier status unknown; `PARTIAL_FAILURE` some recipients failed; `STALE_DATA` last successful snapshot outside freshness SLA; `SOURCE_LIMITED` method/provider returns partial coverage; `INSUFFICIENT_CREDITS`; `CONSENT_REQUIRED`; `REGULATED_WORKFLOW_BLOCKED`; `AI_OUTPUT_REVIEW_REQUIRED`. No fake live feed, created pages, posts or actual rankings.

## H. Wireframe acceptance

v0.app must deliver design files/components against real feature and API contracts; Cursor must return real backend data/status to power screens. Both must preserve current shell and existing approval. Verify all proposed screen actions, deep links, account/site/group context, tab order and mobile behavior in the dedicated UI rollout batch. No API work should silently modify v0-owned presentation files, and no UI work should mutate schema/permissions without Cursor coordination.
