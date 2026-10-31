# Route and Navigation Register

**Inventory date:** 2026-10-29 · **Source:** integration branch over `main` `69981c4c9576e8cc43ebe83aa2b486f27db5a6f3` · **Checker:** `scripts/validate-routes.mjs`

Locales are `en` (unprefixed) and `es` (`/es/...`), via `proxy.ts` and `app/[locale]`. A nav href is unprefixed. The checker strips `[locale]` and requires an exact `page.tsx`. Dynamic segments such as `[siteId]` are real routes; they are not treated as broken links.

Registered navigation sources:

- `config/navigation.ts` — public header
- `lib/portal/modules.ts` — customer dashboard
- `components/admin/shell.tsx` — admin shell

## Public pages

| Path | Source page | Indexing | State |
|---|---|---|---|
| `/` | `app/[locale]/page.tsx` | Sitemap static path | MERGED |
| `/solutions`, `/solutions/[slug]` | `app/[locale]/solutions` | Index in sitemap; slugs come from content | MERGED |
| `/industries`, `/industries/[slug]` | `app/[locale]/industries` | Index in sitemap | MERGED |
| `/crm` | `app/[locale]/crm/page.tsx` | Public marketing page, not the CRM API | MERGED |
| `/hosting`, `/domains` | matching `page.tsx` | Sitemap static paths | MERGED |
| `/case-studies`, `/blog` and `[slug]` | matching pages | Sitemap; slugs from content | MERGED |
| `/pricing`, `/about`, `/contact`, `/get-started` | matching pages | Sitemap static paths | MERGED |
| `/support` | `app/[locale]/support/page.tsx` | Added to the sitemap only when `features.support` is on (it is `true` in source) | MERGED |
| `/privacy`, `/terms`, `/accessibility` | matching pages | Added from `content/legal`, not the static array | MERGED |
| `/login` | `app/[locale]/login/page.tsx` | `noindex`; `robots.ts` disallows `/login` | MERGED |
| catch-all | `app/[locale]/[...rest]/page.tsx` | Not a sitemap target | MERGED |

## Customer dashboard

All of these exist as `app/[locale]/dashboard/**/page.tsx`. They are authenticated and `noindex` from `app/[locale]/dashboard/layout.tsx`. State: MERGED in source and included in production SHA `c0a21db`. Activation of module data is separate.

`/dashboard`, `/dashboard/project`, `/dashboard/sites`, `/dashboard/sites/[siteId]`, `/dashboard/files`, `/dashboard/messages`, `/dashboard/approvals`, `/dashboard/requests`, `/dashboard/review`, `/dashboard/support`, `/dashboard/services`, `/dashboard/marketplace`, `/dashboard/billing`, `/dashboard/analytics`, `/dashboard/ai-employees`, `/dashboard/notifications`, `/dashboard/settings/notifications`, `/dashboard/infrastructure`, `/dashboard/infrastructure/domains`, `/dashboard/infrastructure/email`, `/dashboard/infrastructure/hosting`.

**Batch 16 customer workspaces (MERGED on `main`, PR #54):** 25 locked routes under `/dashboard/crm/**` (9 pages), `/dashboard/marketing/**` (10 pages), and `/dashboard/seo/**` (6 pages). English unprefixed and Spanish `/es/dashboard/...` variants resolve via `app/[locale]/dashboard/`. Dynamic segments: `/dashboard/crm/contacts/[contactId]`, `/dashboard/marketing/requests/[requestId]`, `/dashboard/marketing/deliverables/[artifactId]`, `/dashboard/marketing/campaigns/[campaignId]`. `/dashboard/social` and `/dashboard/crm/leads` are not part of Batch 16.

**Batch 24B CRM workflow UI (MERGED PR #68):** `/dashboard/crm/merges` (merge review); Contacts links to merges. Import and Segments pages extended for Batch 23 API contracts (v0 @ `bc531bb`).

**Batch 25 + 25.1 CRM audience planning APIs (MERGED PR #69, PR #70):** `GET /api/v1/marketing/crm-segments`, `POST /api/v1/marketing/crm-segments/[segmentId]/audience-preview`; `POST /api/v1/marketing/requests` accepts `crmSegmentId` with `CAMPAIGN_PREPARATION`. Contract: [`docs/platform/docs/MKT-25-CRM-AUDIENCE-PLANNING-API-CONTRACT.md`](platform/docs/MKT-25-CRM-AUDIENCE-PLANNING-API-CONTRACT.md).

**Batch 26B CRM audience planning UI (MERGED PR #71):** Marketing Studio **Requests** and **Request detail** wire segment list, audience preview, and segment-linked `CAMPAIGN_PREPARATION` drafts (v0 Batch 26A @ `110c071c`).

**Batch 27A/27A.2 Business Command Center backend (MERGED on `main`):** `GET /api/v1/business/overview` — read-only cross-module action summary. Contract: [`docs/platform/docs/BATCH27A-BUSINESS-COMMAND-CENTER-API-CONTRACT.md`](platform/docs/BATCH27A-BUSINESS-COMMAND-CENTER-API-CONTRACT.md). Does not replace `/dashboard` project Action Center.

**Batch 27B/27C Business Command Center UI (27C IN PR):** `/dashboard/business` (EN), `/es/dashboard/business` (ES) — v0 @ `25220431`; uses overview API and `{ value, scope }` summary metrics. Project overview remains `/dashboard`.

**Batch 20C communications workspace (MERGED PR #62):** `/dashboard/communications`, `/dashboard/communications/conversations/[id]`, `/dashboard/communications/connections` (v0 Batch 20B UI + Cursor nav). Project messaging remains `/dashboard/messages`.

`getDashboardNavModules()` includes CRM → `/dashboard/crm`, **Communications** → `/dashboard/communications`, Marketing Studio → `/dashboard/marketing`, and Local SEO → `/dashboard/seo`, plus the overview, project, core portal, marketplace, billing, analytics, and AI employees routes. Infrastructure and notification links are present in source because `infrastructureManagement` and `automationNotifications` are `true` in `config/features.ts`. Registry keys such as `scheduler` have no `route` and are not pages. Nav visibility is not authorization; CRM, Marketing, and SEO APIs remain flag-disabled at source defaults.

## Admin

`noindex` from `app/[locale]/admin/layout.tsx`. Shell links resolve to pages: `/admin`, `/admin/customers`, `/admin/leads`, `/admin/service-orders`, `/admin/commerce`, `/admin/infrastructure`, `/admin/automation`, `/admin/projects`, `/admin/sites`, `/admin/approvals`, `/admin/requests`, `/admin/support`. Detail routes (`[customerId]`, `[leadId]`, `[projectId]`, `[siteId]`, `[orderId]`) and `/admin/onboarding` exist and are not top-level shell hrefs.

## API families

Route handlers under `app/api`, MERGED, not indexed:

| Family | Path prefix |
|---|---|
| Auth | `/api/auth/[...nextauth]` |
| Workers | `/api/automation/worker`, `/api/automation/workflow-worker`, `/api/v1/analytics/sync/worker` |
| Analytics | `/api/v1/analytics/accounts/[accountId]/{overview,properties,traffic,search,local,conversions,trends,sync-status}` |
| Commerce and wallet | `/api/v1/commerce/*`, `/api/v1/admin/commerce/*`, `/api/v1/billing-groups/*`, `/api/v1/wallet/*` |
| CRM, marketing, social, SEO | `/api/v1/crm/*`, `/api/v1/marketing/*`, `/api/v1/social/*`, `/api/v1/seo/*` |
| Business overview (Batch 27A) | `/api/v1/business/overview` |
| Business Command Center UI (Batch 27C) | `/dashboard/business` |

Batch 18A Marketing extensions (backend; UI in Batch 18B): `GET /api/v1/marketing/artifacts` (account-wide list, cursor pagination), `GET /api/v1/marketing/reviews` (approval inbox). Existing per-request artifact and decide routes unchanged.

Batch 19A SEO extensions (backend MERGED PR #59): `GET /api/v1/seo/sites/[siteId]/keywords` (stored GSC per-query rows, cursor + search); overview and performance reuse `loadGscStoredSiteBundle`; opportunities list adds cursor and optional `state`/`severity`/`confidence` filters.

Batch 19B+19C Local SEO UI (MERGED PR #60): `/dashboard/seo`, `/dashboard/seo/keywords`, `/dashboard/seo/opportunities` wired to 19A APIs via `lib/local-seo-ui/**` and `components/local-seo/**` (v0 commit `59315094`).

Batch 17A CRM extensions (backend merged; UI wired in Batch 17B/17C integration PR): `GET /api/v1/crm/contacts` (`q`, `cursor`, `take`), `PATCH /api/v1/crm/deals/[id]/stage`, `PATCH /api/v1/crm/tasks/[id]`, `GET|POST /api/v1/crm/contacts/[id]/consent`, `POST /api/v1/crm/contacts/[id]/suppression`.

Batch 23 CRM data operations (backend; open PR): enriched `POST /api/v1/crm/imports/preview` and `POST /api/v1/crm/imports/commit` outcomes; stable `POST /api/v1/crm/exports` cursor pages; `GET|PATCH|DELETE /api/v1/crm/segments/[id]`; `GET|POST /api/v1/crm/merge-proposals` and `POST /api/v1/crm/merge-proposals/[id]` (`approve`/`reject`).
| Communications and workflows | `/api/v1/communications/*`, `/api/v1/workflows/*` |
| Customer AI | `/api/v1/customer-ai/accounts/[accountId]/*` |
| Files | `/api/files/[fileId]` |

Planned screens in [`docs/platform/docs/05-SITEMAP-WIREFRAMES.md`](platform/docs/05-SITEMAP-WIREFRAMES.md) are targets until a `page.tsx` exists. The checker does not invent those paths.

Batch 16A contract: [`docs/platform/docs/BATCH16-CUSTOMER-BUSINESS-WORKSPACE-CONTRACT.md`](platform/docs/BATCH16-CUSTOMER-BUSINESS-WORKSPACE-CONTRACT.md). Implementation is on the Batch 16B + 16C integration pull request (open for owner review).
