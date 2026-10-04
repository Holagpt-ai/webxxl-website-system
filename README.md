# WebXXL Website System

Public marketing website for WebXXL — websites, built-in CRM, lead capture, campaigns, hosting and domains for local businesses.

## Ownership

| Area | Owner |
| --- | --- |
| Public frontend (pages, components, content, styling, i18n) | v0 |
| Backend, auth, database, APIs, billing, CRM persistence, client portal | Cursor |

The frontend never fakes backend behavior. Integration points live in `lib/integrations/*` and keep stable signatures so Cursor can wire them without UI changes.

## Stack

Next.js (App Router) · React · TypeScript · Tailwind CSS v4 · pnpm

## Localization (EN / ES)

- Locales are defined in `lib/i18n/config.ts`. English is unprefixed (`/pricing`); Spanish uses `/es` (`/es/pricing`). `proxy.ts` handles locale routing.
- UI strings: `lib/i18n/dictionaries/en.ts` (source of truth for the `Dictionary` type) and `es.ts`.
- Content uses `Localized` values (`{ en, es }`), resolved with `t()` from `lib/i18n/localize.ts`.

**Adding a locale:** add it to `lib/i18n/config.ts`, create `lib/i18n/dictionaries/<code>.ts` matching the `Dictionary` type, register it in `lib/i18n/dictionaries/index.ts`, and add the new key to `Localized` content values.

## Where things live

| Concern | Location |
| --- | --- |
| Services (drives `/solutions/[slug]`) | `content/services.ts` |
| Top-level service routes (`/crm`, `/hosting`, `/domains`) | `lib/routes.ts` → `topLevelServices` |
| Industries (drives `/industries/[slug]`) | `content/industries.ts` |
| Case studies (`isExample` disclosure) | `content/case-studies.ts` |
| Blog, support, legal, page copy | `content/blog.ts`, `content/support.ts`, `content/legal.ts`, `content/pages.ts` |
| Pricing plans and `pricingSettings.showPublicAmounts` | `config/pricing.ts` |
| Feature flags | `config/features.ts` |
| Form backend readiness flags | `config/integrations.ts` |
| Site identity / contact email | `config/site.ts` |
| Navigation and CTAs | `config/navigation.ts`, `config/ctas.ts` |

## Integration boundaries

- `lib/integrations/forms.ts` — contact, newsletter, project intake, strategy call. Until the matching flag in `config/integrations.ts` is `true`, each returns `{ ok: false, error: 'unavailable' }` and the UI shows an honest "not connected yet" message.
- `lib/integrations/billing.ts` — provider-neutral plan actions. No payment provider is chosen.
- `lib/integrations/portal.ts` — client portal link. `/login` stays in a "portal being prepared" state until `NEXT_PUBLIC_CLIENT_PORTAL_URL` is set.

## Pricing

Draft amounts are not public. To publish approved pricing, update the amounts on each plan in `config/pricing.ts` and set `pricingSettings.showPublicAmounts = true`.

## Environment variables

Copy `.env.example` to `.env.local`. All values are public:

- `NEXT_PUBLIC_SITE_URL` — canonical origin for metadata and sitemap
- `NEXT_PUBLIC_CLIENT_PORTAL_URL` — client portal URL
- `NEXT_PUBLIC_CONTACT_EMAIL` — confirmed public inbox (no email is shown while empty)

## Commands

```bash
pnpm install
pnpm dev        # development server
pnpm typecheck  # tsc --noEmit
pnpm build      # production build (fails on TypeScript errors)
pnpm start      # serve production build
```
