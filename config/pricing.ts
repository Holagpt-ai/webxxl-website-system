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
  showPreliminaryNotice: false,
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
        'Mobile-friendly + SEO-ready + AEO',
        'Google Business Profile setup',
        '30 days of done-for-you edits',
        'Email support',
      ],
      es: [
        'Sitio web personalizado de 10 páginas',
        'Hosting + SSL gratis incluidos',
        'Programador de redes sociales incluido',
        'Optimizado para móviles, SEO y AEO',
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

/**
 * Plain-language explanations shown in hover/tap tooltips on pricing
 * feature bullets. Keyed by the exact feature string per locale —
 * features without an entry simply show no info icon.
 */
export const featureTooltips: Localized<Record<string, string>> = {
  en: {
    '10-page custom website':
      'A professionally designed, done-for-you website with up to 10 pages — Home, Services, About, Contact and more. We write the words and build the pages.',
    'Hosting + free SSL included':
      'Fast, secure hosting on our servers plus the HTTPS padlock Google requires. Included in your plan — nothing extra to buy or configure.',
    'Social media scheduler included':
      'Connect your YouTube, Instagram, Facebook and TikTok. Plan a month of posts in one sitting and the scheduler publishes them automatically — autonomous social media, all done for you.',
    'Mobile-friendly + SEO-ready + AEO':
      'Mobile-friendly: your site looks perfect on phones, where most customers browse. SEO-ready: Google-friendly structure, fast loading and sitemaps so you show up in search. AEO: structured so AI assistants like ChatGPT and Google AI Overviews can quote your business in their answers.',
    'Google Business Profile setup':
      'We create and verify your Google Business listing so you appear on Google Maps and local search — with your hours, photos, services and reviews.',
    '30 days of done-for-you edits':
      'Just email or text us the change — new hours, a new photo, a new service — and we update your site for you. No DIY, no logins to figure out.',
    'Email support': 'Real human help by email whenever you need it.',
    'Up to 20 pages': 'Room to grow — up to 20 pages for service areas, galleries, team bios and more.',
    'Google Business Profile managed & optimized':
      'We manage your Google listing month after month: fresh posts and offers, new photos, review responses and ranking optimization.',
    'Advanced SEO':
      'Keyword research, optimized titles and descriptions, local SEO, speed tuning and ongoing tweaks to climb Google rankings and stay there.',
    'Unlimited done-for-you edits':
      'Unlimited changes, done for you. Text or email us anytime — new photos, prices, pages — and we handle it, usually within one business day.',
    'Lead capture forms + live chat':
      'Quote and contact forms that email you every lead instantly, plus live chat on your site so visitors turn into customers while they browse.',
    'Monthly performance report':
      'A plain-English email every month: visitors, calls, form fills and exactly what we improved. No confusing dashboards.',
    'Priority support': 'Jump the queue — your requests get handled first, by the same team that built your site.',
    'Unlimited pages': 'Add as many pages as your business needs — new services, locations, case studies. Never pay per page again.',
    'Built-in CRM & pipelines':
      'Every lead lands in your own CRM automatically. Track calls, follow-ups and deals in simple visual pipelines — no sticky notes, no lost leads.',
    'SMS & email campaigns (monthly credits included)':
      'Send promotions straight to customer phones and inboxes. Monthly sending credits are included, and we can run the campaigns for you.',
    'Online booking':
      'Customers book appointments online 24/7, synced to your calendar with automatic reminders. Fewer no-shows, no phone tag.',
    'Ecommerce': 'Sell products online with secure checkout, card payments and automatic order emails.',
    'Dedicated account manager':
      'One person who knows your business — strategy, updates and priority help whenever you need it.',
  },
  es: {
    'Sitio web personalizado de 10 páginas':
      'Un sitio web profesional hecho por nosotros con hasta 10 páginas: Inicio, Servicios, Nosotros, Contacto y más. Escribimos los textos y construimos las páginas.',
    'Hosting + SSL gratis incluidos':
      'Hosting rápido y seguro en nuestros servidores más el candado HTTPS que exige Google. Incluido en tu plan, sin nada extra que comprar o configurar.',
    'Programador de redes sociales incluido':
      'Conecta tu YouTube, Instagram, Facebook y TikTok. Planifica un mes de publicaciones de una vez y el programador las publica automáticamente: redes sociales autónomas, todo hecho por nosotros.',
    'Optimizado para móviles, SEO y AEO':
      'Móviles: tu sitio se ve perfecto en teléfonos, donde navega la mayoría de tus clientes. SEO: estructura optimizada para Google, carga rápida y sitemaps para aparecer en búsquedas. AEO: estructurado para que asistentes de IA como ChatGPT y Google AI Overviews citen tu negocio en sus respuestas.',
    'Configuración de Google Business Profile':
      'Creamos y verificamos tu ficha de Google Business para que aparezcas en Google Maps y búsquedas locales, con horario, fotos, servicios y reseñas.',
    '30 días de ediciones hechas por nosotros':
      'Solo envíanos el cambio por correo o mensaje — nuevo horario, nueva foto, nuevo servicio — y actualizamos tu sitio en un día hábil. Sin hacerlo tú mismo.',
    'Soporte por correo': 'Ayuda humana real por correo electrónico cuando la necesites.',
    'Hasta 20 páginas': 'Espacio para crecer: hasta 20 páginas para áreas de servicio, galerías, equipo y más.',
    'Google Business Profile gestionado y optimizado':
      'Gestionamos tu ficha de Google mes a mes: publicaciones y ofertas, fotos nuevas, respuestas a reseñas y optimización de posicionamiento.',
    'SEO avanzado':
      'Investigación de palabras clave, títulos y descripciones optimizados, SEO local, velocidad y ajustes continuos para subir en Google y mantenerte ahí.',
    'Ediciones ilimitadas hechas por nosotros':
      'Cambios ilimitados, hechos por nosotros. Escríbenos cuando quieras — fotos, precios, páginas nuevas — y lo resolvemos, normalmente en un día hábil.',
    'Formularios de captación + chat en vivo':
      'Formularios de contacto y cotización que te avisan cada lead al instante, más chat en vivo en tu sitio para convertir visitantes en clientes.',
    'Informe mensual de rendimiento':
      'Un correo mensual en lenguaje simple: visitas, llamadas, formularios y lo que mejoramos. Sin paneles confusos.',
    'Soporte prioritario': 'Tus solicitudes van primero, atendidas por el mismo equipo que construyó tu sitio.',
    'Páginas ilimitadas':
      'Agrega todas las páginas que necesite tu negocio: servicios, ubicaciones, casos de éxito. Nunca más pagues por página.',
    'CRM integrado y embudos':
      'Cada lead llega automáticamente a tu CRM. Sigue llamadas y oportunidades en embudos visuales simples: sin notas adhesivas ni leads perdidos.',
    'Campañas por SMS y correo (créditos mensuales incluidos)':
      'Envía promociones directo al teléfono y correo de tus clientes. Incluye créditos mensuales de envío, y podemos manejar las campañas por ti.',
    'Reservas en línea':
      'Tus clientes reservan citas en línea 24/7, sincronizado con tu calendario y con recordatorios automáticos. Menos ausencias, sin llamadas perdidas.',
    'Tienda en línea': 'Vende productos en línea con pago seguro, tarjetas y correos automáticos de pedido.',
    'Gerente de cuenta dedicado':
      'Una persona que conoce tu negocio: estrategia, actualizaciones y ayuda prioritaria cuando la necesites.',
  },
}

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
