import type { Localized } from '@/lib/i18n/localize'
import { l } from './types'

export type CaseStudyMetric = { value: string; label: Localized }

export type CaseStudy = {
  slug: string
  enabled: boolean
  /**
   * true = illustrative demo project (not a real client). Shows an "Example project" badge,
   * a disclaimer, and labels metrics as illustrative. Set false only for verified real clients.
   */
  isExample: boolean
  company: string
  industry: string
  projectType: Localized
  summary: Localized
  image: string
  imageAlt: Localized
  gallery?: { src: string; alt: Localized }[]
  challenge: Localized
  approach: Localized
  solution: Localized
  services: string[]
  /** Metrics must be verified for real clients. For examples they are illustrative targets only. */
  metrics: CaseStudyMetric[]
  testimonial?: { quote: Localized; author: string; role: Localized }
}

export const caseStudies: CaseStudy[] = [
  {
    slug: 'summit-hvac',
    enabled: true,
    isExample: true,
    company: 'Summit HVAC',
    industry: 'hvac',
    projectType: l('Rebrand, website & CRM', 'Renovación de marca, sitio web y CRM'),
    summary: l('A complete rebrand with a new website and CRM.', 'Una renovación completa con nuevo sitio web y CRM.'),
    image: '/images/case-studies/summit-hvac.png',
    imageAlt: l('Summit HVAC branded service van parked outside a home', 'Camioneta de servicio de Summit HVAC frente a una casa'),
    challenge: l(
      'An established heating and cooling company relied on word of mouth and an outdated website. Calls and form requests were tracked in a spreadsheet, and seasonal maintenance customers were rarely contacted again.',
      'Una empresa de climatización establecida dependía del boca a boca y de un sitio anticuado. Llamadas y formularios se registraban en una hoja de cálculo y los clientes de mantenimiento rara vez recibían seguimiento.',
    ),
    approach: l(
      'We mapped their highest-value services — emergency repair, system replacement and maintenance plans — and designed a site structure and CRM pipeline around each one.',
      'Identificamos sus servicios de mayor valor —reparación urgente, reemplazo de equipos y planes de mantenimiento— y diseñamos la estructura del sitio y el embudo del CRM alrededor de cada uno.',
    ),
    solution: l(
      'A refreshed brand, a mobile-first website with service-area pages and click-to-call, and WebXXL CRM with seasonal SMS reminders for maintenance customers.',
      'Una marca renovada, un sitio pensado para móviles con páginas por zona y clic para llamar, y WebXXL CRM con recordatorios por SMS de temporada.',
    ),
    services: ['website-design', 'crm', 'campaigns', 'hosting'],
    metrics: [
      { value: '+150%', label: l('More leads', 'Más contactos') },
      { value: '+89%', label: l('Booked appointments', 'Citas agendadas') },
      { value: '3x', label: l('ROI in 6 months', 'Retorno en 6 meses') },
    ],
  },
  {
    slug: 'carter-roofing',
    enabled: true,
    isExample: true,
    company: 'Carter Roofing',
    industry: 'roofing',
    projectType: l('Website, lead capture & campaigns', 'Sitio web, captación y campañas'),
    summary: l('New website, lead capture and campaigns.', 'Nuevo sitio web, captación de clientes y campañas.'),
    image: '/images/case-studies/carter-roofing.png',
    imageAlt: l('Craftsman-style home with a newly installed charcoal roof', 'Casa estilo craftsman con un techo nuevo color carbón'),
    challenge: l(
      'Storm-season demand spiked every year, but inspection requests arrived by phone, text and social messages with no single place to track them.',
      'La demanda por tormentas se disparaba cada año, pero las solicitudes llegaban por teléfono, texto y redes sin un lugar único para seguirlas.',
    ),
    approach: l(
      'We focused on one conversion — the free inspection — and built dedicated landing pages for storm damage and full replacement.',
      'Nos enfocamos en una conversión —la inspección gratuita— y creamos páginas dedicadas a daños por tormenta y reemplazo completo.',
    ),
    solution: l(
      'A new website with project galleries, inspection request forms routed into WebXXL CRM, and follow-up email campaigns for homeowners awaiting insurance decisions.',
      'Un nuevo sitio con galerías, formularios de inspección conectados a WebXXL CRM y campañas de seguimiento para propietarios en espera del seguro.',
    ),
    services: ['website-design', 'landing-pages', 'lead-capture', 'campaigns'],
    metrics: [
      { value: '+212%', label: l('Website traffic', 'Tráfico web') },
      { value: '+125%', label: l('Quote requests', 'Solicitudes de cotización') },
      { value: '2.8x', label: l('Revenue growth', 'Crecimiento de ingresos') },
    ],
  },
  {
    slug: 'luxe-aesthetics',
    enabled: true,
    isExample: true,
    company: 'Luxe Aesthetics',
    industry: 'med-spas',
    projectType: l('Website, CRM & automated follow-ups', 'Sitio web, CRM y seguimientos automáticos'),
    summary: l('Website, CRM and automated follow-ups.', 'Sitio web, CRM y seguimientos automáticos.'),
    image: '/images/case-studies/luxe-aesthetics.png',
    imageAlt: l('Bright, modern med spa treatment room', 'Sala de tratamiento luminosa y moderna de un med spa'),
    challenge: l(
      'A growing med spa had loyal clients but no structured way to bring them back for follow-up treatments or promote memberships.',
      'Un med spa en crecimiento tenía clientes fieles pero ninguna forma estructurada de hacerlos volver o promover membresías.',
    ),
    approach: l(
      'We organized treatments into clear menus and designed rebooking journeys based on typical treatment intervals.',
      'Organizamos los tratamientos en menús claros y diseñamos recorridos de nueva reserva según los intervalos habituales.',
    ),
    solution: l(
      'An elegant website with treatment pages and membership sign-ups, connected to WebXXL CRM with automated rebooking reminders by SMS and email.',
      'Un sitio elegante con páginas de tratamientos y membresías, conectado a WebXXL CRM con recordatorios automáticos por SMS y correo.',
    ),
    services: ['website-design', 'crm', 'campaigns', 'ecommerce'],
    metrics: [
      { value: '+180%', label: l('New clients', 'Nuevos clientes') },
      { value: '+70%', label: l('Rebooking rate', 'Tasa de nuevas reservas') },
      { value: '2.5x', label: l('Revenue growth', 'Crecimiento de ingresos') },
    ],
  },
]

export function getCaseStudies(): CaseStudy[] {
  return caseStudies.filter((c) => c.enabled)
}

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return getCaseStudies().find((c) => c.slug === slug)
}

export function getCaseStudiesBySlugs(slugs: string[]): CaseStudy[] {
  return slugs.map((s) => getCaseStudy(s)).filter((c): c is CaseStudy => Boolean(c))
}

export function getCaseStudiesForIndustry(industrySlug: string): CaseStudy[] {
  return getCaseStudies().filter((c) => c.industry === industrySlug)
}

export function getCaseStudiesForService(serviceSlug: string): CaseStudy[] {
  return getCaseStudies().filter((c) => c.services.includes(serviceSlug))
}
