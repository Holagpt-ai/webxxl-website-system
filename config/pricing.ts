import type { Localized } from '@/lib/i18n/localize'

/**
 * TEMPORARY PRICING — V1. NOT FINAL.
 * The Startup ($99), Business ($399) and Elite ($999) one-time website build packages below are a temporary
 * business configuration and are subject to future revision. To change prices, packages or
 * features, edit this file only — no component changes are needed.
 *
 * billingType (how the amount is charged):
 *  - oneTime → "$X one-time"   (current website build packages)
 *  - monthly → "$X /mo"        (future: hosting, CRM, maintenance, SEO, etc.)
 *  - annual  → "$X /yr"
 *  - custom  → "Custom pricing" (uses displayPrice if provided)
 *
 * priceModel (how the amount is presented):
 *  - fixed      → exact amount
 *  - startingAt → "Starting at $X"
 *  - contact    → no amount, "Custom pricing"
 *  - free       → "Free"
 *
 * Recurring services must be added as their own plans — never folded into a one-time build price.
 */
export type BillingType = 'oneTime' | 'monthly' | 'annual' | 'custom'
export type PriceModel = 'fixed' | 'startingAt' | 'contact' | 'free'
export type PlanStatus = 'draft' | 'active' | 'retired'

export type PricingPlan = {
  id: string
  slug: string
  name: Localized
  description: Localized
  billingType: BillingType
  priceModel: PriceModel
  priceAmount?: number | null
  setupFee?: number | null
  displayPrice?: Localized
  currency: string
  features: Localized<string[]>
  /** Footnote shown under the feature list, e.g. explaining items marked with "*". */
  footnote?: Localized
  highlighted?: boolean
  badge?: Localized
  promotion?: Localized
  enabled: boolean
  showOnHome: boolean
  status: PlanStatus
  ctaLabel: Localized
  ctaHref?: string
}

export const pricingSettings = {
  currency: 'USD',
  /** When false, numeric amounts are never rendered; cards show "Pricing being finalized". */
  showPublicAmounts: true,
  showPreliminaryNotice: false,
}

const conditionsFootnote: Localized = {
  en: '*Subject to WebXXL terms and project scope. Third-party services may require separate accounts or fees.',
  es: '*Sujeto a los términos de WebXXL y al alcance del proyecto. Los servicios de terceros pueden requerir cuentas o tarifas aparte.',
}

export const pricingPlans: PricingPlan[] = [
  {
    id: 'plan_startup_website',
    slug: 'startup',
    name: { en: 'Startup Website', es: 'Sitio Web Startup' },
    description: {
      en: 'A fast, professional website for startups and small businesses.',
      es: 'Un sitio web rápido y profesional para startups y pequeños negocios.',
    },
    billingType: 'oneTime',
    priceModel: 'fixed',
    priceAmount: 99,
    currency: 'USD',
    features: {
      en: [
        'Up to 5-page website',
        'Fully mobile responsive',
        'Basic chatbot integration',
        'Up to 25 industry-specific stock images',
        'Contact / lead capture form',
        'Up to 3 custom banner or hero graphics',
        'SEO-friendly XML sitemap',
        'Standards-compliant semantic HTML',
        'Basic on-page SEO setup',
        'Vercel deployment',
        'Typical turnaround: 48–72 hours after required content and assets are received',
        'Custom design tailored to the business',
        'Satisfaction guarantee*',
        'Money-back guarantee*',
      ],
      es: [
        'Sitio web de hasta 5 páginas',
        'Totalmente adaptable a móviles',
        'Integración básica de chatbot',
        'Hasta 25 imágenes de stock específicas de tu industria',
        'Formulario de contacto / captación de prospectos',
        'Hasta 3 gráficos personalizados de banner o portada',
        'Mapa del sitio XML optimizado para SEO',
        'HTML semántico conforme a estándares',
        'Configuración básica de SEO on-page',
        'Despliegue en Vercel',
        'Entrega típica: 48–72 horas después de recibir el contenido y los recursos requeridos',
        'Diseño personalizado para tu negocio',
        'Garantía de satisfacción*',
        'Garantía de devolución de dinero*',
      ],
    },
    footnote: conditionsFootnote,
    enabled: true,
    showOnHome: true,
    status: 'active',
    ctaLabel: { en: 'Get Started', es: 'Comenzar' },
  },
  {
    id: 'plan_business_website',
    slug: 'business',
    name: { en: 'Business Website', es: 'Sitio Web Business' },
    description: {
      en: 'A more complete website for growing businesses that need stronger lead generation and marketing capabilities.',
      es: 'Un sitio web más completo para negocios en crecimiento que necesitan mayor captación de prospectos y capacidades de marketing.',
    },
    billingType: 'oneTime',
    priceModel: 'fixed',
    priceAmount: 399,
    currency: 'USD',
    features: {
      en: [
        'Up to 10 custom pages',
        'Fully mobile responsive',
        'Everything in Startup',
        'Enhanced custom UI/UX',
        'CRM-ready lead capture',
        'Advanced contact / quote forms',
        'Appointment / booking integration',
        'Blog or news section',
        'Social media integration',
        'Google Analytics integration',
        'Google Search Console setup',
        'SEO-friendly XML sitemap',
        'On-page SEO setup',
        'Technical SEO foundation',
        'AEO / AI-search optimization foundation',
        'Custom calls-to-action',
        'Additional custom graphics',
        'Vercel deployment',
        'Typical turnaround: 5–7 business days after required content and assets are received',
        'Satisfaction guarantee*',
      ],
      es: [
        'Hasta 10 páginas personalizadas',
        'Totalmente adaptable a móviles',
        'Todo lo incluido en Startup',
        'UI/UX personalizada mejorada',
        'Captación de prospectos lista para CRM',
        'Formularios avanzados de contacto / cotización',
        'Integración de citas / reservaciones',
        'Sección de blog o noticias',
        'Integración con redes sociales',
        'Integración con Google Analytics',
        'Configuración de Google Search Console',
        'Mapa del sitio XML optimizado para SEO',
        'Configuración de SEO on-page',
        'Base de SEO técnico',
        'Base de optimización AEO / búsqueda con IA',
        'Llamados a la acción personalizados',
        'Gráficos personalizados adicionales',
        'Despliegue en Vercel',
        'Entrega típica: 5–7 días hábiles después de recibir el contenido y los recursos requeridos',
        'Garantía de satisfacción*',
      ],
    },
    footnote: conditionsFootnote,
    highlighted: true,
    badge: { en: 'Most Popular', es: 'Más popular' },
    enabled: true,
    showOnHome: true,
    status: 'active',
    ctaLabel: { en: 'Get Started', es: 'Comenzar' },
  },
  {
    id: 'plan_elite_website',
    slug: 'elite',
    name: { en: 'Elite Website', es: 'Sitio Web Elite' },
    description: {
      en: 'A larger custom website for established businesses that need advanced functionality.',
      es: 'Un sitio web a medida más amplio para negocios establecidos que necesitan funciones avanzadas.',
    },
    billingType: 'oneTime',
    priceModel: 'fixed',
    priceAmount: 999,
    currency: 'USD',
    features: {
      en: [
        'Up to 25 custom pages',
        'Fully mobile responsive',
        'CMS / Admin Panel',
        'Premium custom UI/UX',
        'Interactive animations and hover effects',
        'Appointment / reservation integration*',
        'Payment gateway integration*',
        'Book-a-call CTA integration',
        'Custom contact forms',
        'Advanced lead capture forms and CTAs',
        'Newsletter signup integration',
        'Blog / news publishing capability',
        'Social media integration',
        'Multiple licensed stock images',
        'Custom unique banner designs',
        'Interactive sliders and carousels',
        'Google Search Console setup',
        'XML sitemap submission',
        'On-page SEO',
        'Technical SEO',
        'AEO / AI-search optimization foundation',
        'Standards-compliant semantic HTML',
        'Performance optimization',
        'Complete Vercel deployment',
        'Typical turnaround: 7–14 business days after required content and assets are received',
        'Custom design tailored to the business',
        'Satisfaction guarantee*',
      ],
      es: [
        'Hasta 25 páginas personalizadas',
        'Totalmente adaptable a móviles',
        'CMS / Panel de administración',
        'UI/UX premium personalizada',
        'Animaciones interactivas y efectos al pasar el cursor',
        'Integración de citas / reservaciones*',
        'Integración de pasarela de pago*',
        'Integración de CTA para agendar llamada',
        'Formularios de contacto personalizados',
        'Formularios y CTAs avanzados de captación de prospectos',
        'Integración de suscripción al boletín',
        'Capacidad de publicación de blog / noticias',
        'Integración con redes sociales',
        'Múltiples imágenes de stock con licencia',
        'Diseños de banner únicos y personalizados',
        'Sliders y carruseles interactivos',
        'Configuración de Google Search Console',
        'Envío del mapa del sitio XML',
        'SEO on-page',
        'SEO técnico',
        'Base de optimización AEO / búsqueda con IA',
        'HTML semántico conforme a estándares',
        'Optimización de rendimiento',
        'Despliegue completo en Vercel',
        'Entrega típica: 7–14 días hábiles después de recibir el contenido y los recursos requeridos',
        'Diseño personalizado para tu negocio',
        'Garantía de satisfacción*',
      ],
    },
    footnote: conditionsFootnote,
    enabled: true,
    showOnHome: true,
    status: 'active',
    ctaLabel: { en: 'Start My Project', es: 'Iniciar mi proyecto' },
  },
  {
    // Retained for future use; disabled so only the temporary website packages are public.
    id: 'plan_custom',
    slug: 'custom',
    name: { en: 'Custom', es: 'Personalizado' },
    description: { en: 'Agencies, franchises and complex builds.', es: 'Agencias, franquicias y proyectos complejos.' },
    billingType: 'custom',
    priceModel: 'contact',
    currency: 'USD',
    features: {
      en: ['Custom scope & roadmap', 'Multiple websites or brands', 'Migration assistance', 'Tailored support agreement'],
      es: ['Alcance y hoja de ruta a medida', 'Varios sitios o marcas', 'Asistencia de migración', 'Acuerdo de soporte a medida'],
    },
    enabled: false,
    showOnHome: false,
    status: 'draft',
    ctaLabel: { en: 'Contact WebXXL', es: 'Contactar a WebXXL' },
    ctaHref: '/contact?reason=custom-plan',
  },
]

export function getPlans(options: { homeOnly?: boolean } = {}): PricingPlan[] {
  return pricingPlans.filter((p) => p.enabled && p.status === 'active' && (!options.homeOnly || p.showOnHome))
}
