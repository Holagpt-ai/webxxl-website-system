import type { Localized } from '@/lib/i18n/localize'

export const siteConfig = {
  name: 'WebXXL',
  /** Set NEXT_PUBLIC_SITE_URL in production; used for canonical URLs, sitemap and Open Graph. */
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.webbxxl.com').replace(/\/$/, ''),
  /** Placeholder contact address — replace once the production inbox is confirmed. */
  email: 'hello@webbxxl.com',
  responseTime: { en: 'We reply within one business day.', es: 'Respondemos en un día hábil.' } as Localized,
  hours: { en: 'Monday–Friday, 9am–6pm', es: 'Lunes a viernes, 9am–6pm' } as Localized,
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
