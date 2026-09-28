import type { Localized } from '@/lib/i18n/localize'

/**
 * PRICING IS NOT FINAL. All amounts below are visual placeholders.
 * Change prices, plans, badges and promotions here — no component changes needed.
 *
 * priceModel:
 *  - fixed      → "$X /mo"
 *  - startingAt → "Starting at $X /mo"
 *  - contact    → "Custom pricing" (uses displayPrice if provided)
 *  - free       → "Free"
 */
export type PriceModel = 'fixed' | 'startingAt' | 'contact' | 'free'

export type PricingPlan = {
  id: string
  slug: string
  name: Localized
  description: Localized
  priceModel: PriceModel
  priceMonthly?: number | null
  priceAnnual?: number | null
  setupFee?: number | null
  displayPrice?: Localized
  currency: string
  features: Localized<string[]>
  highlighted?: boolean
  badge?: Localized
  promotion?: Localized
  enabled: boolean
  showOnHome: boolean
  ctaLabel: Localized
  ctaHref?: string
}

export const pricingSettings = {
  currency: 'USD',
  showPreliminaryNotice: true,
}

export const pricingPlans: PricingPlan[] = [
  {
    id: 'plan_starter',
    slug: 'starter',
    name: { en: 'Starter', es: 'Inicial' },
    description: { en: 'Perfect for small businesses.', es: 'Ideal para negocios pequeños.' },
    priceModel: 'fixed',
    priceMonthly: 199,
    priceAnnual: null,
    currency: 'USD',
    features: {
      en: ['Website (up to 5 pages)', 'Built-in CRM', 'Hosting & domain management', 'Lead capture forms', 'Email support'],
      es: ['Sitio web (hasta 5 páginas)', 'CRM integrado', 'Gestión de hosting y dominio', 'Formularios de captación', 'Soporte por correo'],
    },
    enabled: true,
    showOnHome: true,
    ctaLabel: { en: 'Get Started', es: 'Comenzar' },
  },
  {
    id: 'plan_growth',
    slug: 'growth',
    name: { en: 'Growth', es: 'Crecimiento' },
    description: { en: 'For growing local businesses.', es: 'Para negocios locales en crecimiento.' },
    priceModel: 'fixed',
    priceMonthly: 299,
    priceAnnual: null,
    currency: 'USD',
    features: {
      en: ['Everything in Starter', 'Advanced CRM & pipelines', 'SMS & email campaigns', 'Analytics & reporting', 'Priority support'],
      es: ['Todo lo de Inicial', 'CRM avanzado y embudos', 'Campañas por SMS y correo', 'Analítica e informes', 'Soporte prioritario'],
    },
    highlighted: true,
    badge: { en: 'Most popular', es: 'Más popular' },
    enabled: true,
    showOnHome: true,
    ctaLabel: { en: 'Get Started', es: 'Comenzar' },
  },
  {
    id: 'plan_scale',
    slug: 'scale',
    name: { en: 'Scale', es: 'Escala' },
    description: { en: 'For larger or multi-location businesses.', es: 'Para negocios grandes o con varias sedes.' },
    priceModel: 'fixed',
    priceMonthly: 499,
    priceAnnual: null,
    currency: 'USD',
    features: {
      en: ['Everything in Growth', 'Advanced automation tools', 'Multi-location support', 'Custom integrations', 'Dedicated account manager'],
      es: ['Todo lo de Crecimiento', 'Herramientas de automatización avanzadas', 'Soporte para varias sedes', 'Integraciones personalizadas', 'Gerente de cuenta dedicado'],
    },
    enabled: true,
    showOnHome: true,
    ctaLabel: { en: 'Get Started', es: 'Comenzar' },
  },
  {
    id: 'plan_custom',
    slug: 'custom',
    name: { en: 'Custom', es: 'Personalizado' },
    description: { en: 'Agencies, franchises and complex builds.', es: 'Agencias, franquicias y proyectos complejos.' },
    priceModel: 'contact',
    currency: 'USD',
    features: {
      en: ['Custom scope & roadmap', 'Multiple websites or brands', 'Custom CRM configuration', 'Migration assistance', 'Tailored support agreement'],
      es: ['Alcance y hoja de ruta a medida', 'Varios sitios o marcas', 'Configuración de CRM personalizada', 'Asistencia de migración', 'Acuerdo de soporte a medida'],
    },
    enabled: true,
    showOnHome: false,
    ctaLabel: { en: 'Contact WebXXL', es: 'Contactar a WebXXL' },
    ctaHref: '/contact?reason=custom-plan',
  },
]

export const includedInEveryPlan: Localized<string[]> = {
  en: ['Mobile-friendly website', 'WebXXL CRM access', 'Managed hosting & SSL', 'Domain management', 'Security updates', 'Real human support', 'No long-term contracts'],
  es: ['Sitio adaptado a móviles', 'Acceso a WebXXL CRM', 'Hosting gestionado y SSL', 'Gestión de dominio', 'Actualizaciones de seguridad', 'Soporte humano real', 'Sin contratos a largo plazo'],
}

export function getPlans(options: { homeOnly?: boolean } = {}): PricingPlan[] {
  return pricingPlans.filter((p) => p.enabled && (!options.homeOnly || p.showOnHome))
}
