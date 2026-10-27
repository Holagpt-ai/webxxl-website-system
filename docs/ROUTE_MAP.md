# Route and Navigation Register

**Inventory date:** 2026-10-26 · **Source:** `main` `2b7ec7be2aeadccfb595a2ab7edf59b775876efe` · **Checker:** `scripts/validate-routes.mjs`

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

`getDashboardNavModules()` points at the overview, project, core portal, marketplace, billing, analytics, and AI employees routes. Infrastructure and notification links are present in source because `infrastructureManagement` and `automationNotifications` are `true` in `config/features.ts`. Registry keys such as `scheduler` have no `route` and are not pages.

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
| Communications and workflows | `/api/v1/communications/*`, `/api/v1/workflows/*` |
| Customer AI | `/api/v1/customer-ai/accounts/[accountId]/*` |
| Files | `/api/files/[fileId]` |

Planned screens in [`docs/platform/docs/05-SITEMAP-WIREFRAMES.md`](platform/docs/05-SITEMAP-WIREFRAMES.md) are targets until a `page.tsx` exists. The checker does not invent those paths.

Batch 16A locks the customer workspace paths in [`docs/platform/docs/BATCH16-CUSTOMER-BUSINESS-WORKSPACE-CONTRACT.md`](platform/docs/BATCH16-CUSTOMER-BUSINESS-WORKSPACE-CONTRACT.md): `/dashboard/crm/**`, `/dashboard/marketing/**`, and `/dashboard/seo/**`. Those `page.tsx` files do not exist yet, so they are not registered in `getDashboardNavModules()`. `/dashboard/social`, `/dashboard/communications`, and `/dashboard/crm/leads` are not part of that lock.
