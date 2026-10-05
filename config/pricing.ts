import type { Localized } from '@/lib/i18n/localize'

/**
 * WebXXL pricing — v3 (2026-10-05).
 * Affordable subscription ladder built to undercut UENI head-on:
 *   Launch $20/mo  (UENI Launch $24.99)
 *   Plus   $50/mo  (UENI Plus   $59)   ← most popular
 *   Business $90/mo (UENI Ecommerce $99)
 * All plans carry a $79 one-time setup (waived on annual prepay / launch promos).
 *
 * Hosting + SSL are included in every plan (near-zero marginal cost on our
 * multi-tenant VPS). Domain registration and business email are sold as
 * add-ons, not bundled.
 *
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
    id: 'plan_launch',
    slug: 'launch',
    name: { en: 'Launch', es: 'Lanzamiento' },
    description: { en: 'Get your business online fast.', es: 'Tu negocio en línea, rápido.' },
    priceModel: 'fixed',
    priceMonthly: 20,
    priceAnnual: null,
    setupFee: 79,
    currency: 'USD',
    features: {
      en: [
        '10-page custom website',
        'Hosting + free SSL included',
        'Social media scheduler included',
        'Mobile-friendly + SEO-ready',
        'Google Business Profile setup',
        '30 days of done-for-you edits',
        'Email support',
      ],
      es: [
        'Sitio web personalizado de 10 páginas',
        'Hosting + SSL gratis incluidos',
        'Programador de redes sociales incluido',
        'Optimizado para móviles y SEO',
        'Configuración de Google Business Profile',
        '30 días de ediciones hechas por nosotros',
        'Soporte por correo',
      ],
    },
    enabled: true,
    showOnHome: true,
    ctaLabel: { en: 'Get Started', es: 'Comenzar' },
  },
  {
    id: 'plan_plus',
    slug: 'plus',
    name: { en: 'Plus', es: 'Plus' },
    description: { en: 'For businesses ready to grow.', es: 'Para negocios listos para crecer.' },
    priceModel: 'fixed',
    priceMonthly: 50,
    priceAnnual: null,
    setupFee: 79,
    currency: 'USD',
    features: {
      en: [
        'Everything in Launch, plus:',
        'Up to 20 pages',
        'Google Business Profile managed & optimized',
        'Advanced SEO',
        'Unlimited done-for-you edits',
        'Lead capture forms + live chat',
        'Monthly performance report',
        'Priority support',
      ],
      es: [
        'Todo lo de Lanzamiento, más:',
        'Hasta 20 páginas',
        'Google Business Profile gestionado y optimizado',
        'SEO avanzado',
        'Ediciones ilimitadas hechas por nosotros',
        'Formularios de captación + chat en vivo',
        'Informe mensual de rendimiento',
        'Soporte prioritario',
      ],
    },
    highlighted: true,
    badge: { en: 'Most popular', es: 'Más popular' },
    enabled: true,
    showOnHome: true,
    ctaLabel: { en: 'Get Started', es: 'Comenzar' },
  },
  {
    id: 'plan_business',
    slug: 'business',
    name: { en: 'Business', es: 'Negocios' },
    description: { en: 'The full growth engine.', es: 'El motor completo de crecimiento.' },
    priceModel: 'fixed',
    priceMonthly: 90,
    priceAnnual: null,
    setupFee: 79,
    currency: 'USD',
    features: {
      en: [
        'Everything in Plus, plus:',
        'Unlimited pages',
        'Built-in CRM & pipelines',
        'SMS & email campaigns (monthly credits included)',
        'Online booking',
        'Ecommerce',
        'Dedicated account manager',
      ],
      es: [
        'Todo lo de Plus, más:',
        'Páginas ilimitadas',
        'CRM integrado y embudos',
        'Campañas por SMS y correo (créditos mensuales incluidos)',
        'Reservas en línea',
        'Tienda en línea',
        'Gerente de cuenta dedicado',
      ],
    },
    enabled: true,
    showOnHome: true,
    ctaLabel: { en: 'Get Started', es: 'Comenzar' },
  },
]

export const includedInEveryPlan: Localized<string[]> = {
  en: [
    'Professionally designed website',
    'Managed hosting + free SSL',
    'Social media scheduler included',
    'Real human support',
    'No long-term contracts',
    '30-day money-back guarantee',
  ],
  es: [
    'Sitio web de diseño profesional',
    'Hosting gestionado + SSL gratis',
    'Programador de redes sociales incluido',
    'Soporte humano real',
    'Sin contratos a largo plazo',
    'Garantía de devolución de 30 días',
  ],
}

/** Monthly add-ons that plug into any plan ("Add power when you need it"). */
export type PricingAddon = {
  id: string
  name: Localized
  price: Localized
  description: Localized
}

export const pricingAddons: PricingAddon[] = [
  {
    id: 'addon_domain',
    name: { en: 'Domain registration', es: 'Registro de dominio' },
    price: { en: '$20/yr', es: '$20/año' },
    description: {
      en: 'We register and manage your domain for you. Already own one? We connect it free.',
      es: 'Registramos y gestionamos tu dominio por ti. ¿Ya tienes uno? Lo conectamos gratis.',
    },
  },
  {
    id: 'addon_email',
    name: { en: 'Business email', es: 'Correo empresarial' },
    price: { en: '$5/mo', es: '$5/mes' },
    description: {
      en: 'Professional email @yourdomain, set up and managed for you.',
      es: 'Correo profesional @tudominio, configurado y gestionado por nosotros.',
    },
  },
  {
    id: 'addon_location',
    name: { en: 'Extra location', es: 'Ubicación adicional' },
    price: { en: '$40/mo', es: '$40/mes' },
    description: {
      en: 'Add another business location with its own pages and listings.',
      es: 'Agrega otra ubicación de tu negocio con sus propias páginas y listados.',
    },
  },
]

/** Done-for-you services ("Labs") — our team runs your marketing. */
export const pricingLabs: PricingAddon[] = [
  {
    id: 'lab_seo',
    name: { en: 'SEO service', es: 'Servicio SEO' },
    price: { en: 'From $290/mo', es: 'Desde $290/mes' },
    description: {
      en: 'Done-for-you search engine optimization that compounds every month.',
      es: 'Optimización para buscadores hecha por nosotros, que crece cada mes.',
    },
  },
  {
    id: 'lab_social',
    name: { en: 'Social media management', es: 'Gestión de redes sociales' },
    price: { en: 'From $190/mo', es: 'Desde $190/mes' },
    description: {
      en: 'We create, schedule and manage your social content end to end.',
      es: 'Creamos, programamos y gestionamos tu contenido social de principio a fin.',
    },
  },
  {
    id: 'lab_content',
    name: { en: 'Content & video', es: 'Contenido y video' },
    price: { en: 'Custom quote', es: 'Cotización personalizada' },
    description: {
      en: 'Video, photography and AI-accelerated content for your brand.',
      es: 'Video, fotografía y contenido acelerado con IA para tu marca.',
    },
  },
]

export function getPlans(options: { homeOnly?: boolean } = {}): PricingPlan[] {
  return pricingPlans.filter((p) => p.enabled && (!options.homeOnly || p.showOnHome))
}
