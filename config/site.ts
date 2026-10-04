import type { Localized } from '@/lib/i18n/localize'

export const siteConfig = {
  name: 'WebXXL',
  /** Set NEXT_PUBLIC_SITE_URL in production; used for canonical URLs, sitemap and Open Graph. */
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.webxxl.com').replace(/\/$/, ''),
  /**
   * Public contact address. Only rendered when NEXT_PUBLIC_CONTACT_EMAIL is set to a confirmed inbox.
   * Operating hours and response-time commitments are intentionally absent until approved.
   */
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || undefined,
  defaultTitle: {
    en: 'WebXXL — Websites that grow your business, with CRM built in',
    es: 'WebXXL — Sitios web que hacen crecer tu negocio, con CRM integrado',
  } as Localized,
  defaultDescription: {
    en: 'WebXXL builds websites, CRM, lead capture, campaigns, hosting and domains for local businesses — one connected system with real human support.',
    es: 'WebXXL crea sitios web, CRM, captación de clientes, campañas, hosting y dominios para negocios locales: un sistema conectado con soporte humano real.',
  } as Localized,
  twitterHandle: undefined as string | undefined,
}
