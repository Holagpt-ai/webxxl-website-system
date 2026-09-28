import type { IconName } from '@/lib/icons'
import type { Localized } from '@/lib/i18n/localize'
import { l, type ContentItem, type FaqItem, type Seo } from './types'

export type IndustryGroup = 'home' | 'health' | 'professional' | 'hospitality'

export const industryGroups: { id: IndustryGroup; label: Localized }[] = [
  { id: 'home', label: l('Home & field services', 'Servicios para el hogar') },
  { id: 'health', label: l('Health & wellness', 'Salud y bienestar') },
  { id: 'professional', label: l('Professional services', 'Servicios profesionales') },
  { id: 'hospitality', label: l('Hospitality & retail', 'Hospitalidad y comercio') },
]

export type Industry = {
  slug: string
  icon: IconName
  group: IndustryGroup
  enabled: boolean
  featured: boolean
  name: Localized
  /** Used inside sentences, e.g. "Websites built for {inlineName} businesses". */
  inlineName: Localized
  tagline: Localized
  heroDescription: Localized
  capabilities: Localized<string[]>
  services: string[]
  caseStudies?: string[]
  /** Optional overrides of the shared template content. */
  painPoints?: ContentItem[]
  faq?: FaqItem[]
  seo?: Seo
}

/**
 * Add an industry by appending an object. The shared IndustryPageTemplate renders
 * /industries/{slug} and /es/industries/{slug} from this data.
 */
export const industries: Industry[] = [
  {
    slug: 'hvac', icon: 'snowflake', group: 'home', enabled: true, featured: true,
    name: l('HVAC', 'HVAC'), inlineName: l('HVAC', 'climatización'), tagline: l('Heating & cooling', 'Calefacción y aire'),
    heroDescription: l('Win more service calls and maintenance agreements with a website built around emergency repairs, installs and seasonal tune-ups.', 'Consigue más llamadas de servicio y contratos de mantenimiento con un sitio pensado para reparaciones urgentes, instalaciones y ajustes de temporada.'),
    capabilities: { en: ['24/7 emergency call buttons', 'Service area pages', 'Maintenance plan sign-ups', 'Financing information'], es: ['Botones de llamada 24/7', 'Páginas por zona de servicio', 'Registro de planes de mantenimiento', 'Información de financiamiento'] },
    services: ['website-design', 'lead-capture', 'campaigns', 'crm'], caseStudies: ['summit-hvac'],
  },
  {
    slug: 'roofing', icon: 'house', group: 'home', enabled: true, featured: true,
    name: l('Roofing', 'Techado'), inlineName: l('roofing', 'techado'), tagline: l('Repairs & replacement', 'Reparación y reemplazo'),
    heroDescription: l('Turn storm season and replacement projects into booked inspections with trust-building pages and fast quote requests.', 'Convierte la temporada de tormentas y los reemplazos en inspecciones agendadas con páginas que generan confianza y cotizaciones rápidas.'),
    capabilities: { en: ['Free inspection request forms', 'Project galleries', 'Insurance claim guidance', 'Warranty information'], es: ['Formularios de inspección gratuita', 'Galerías de proyectos', 'Guía para reclamos de seguro', 'Información de garantía'] },
    services: ['website-design', 'landing-pages', 'lead-capture', 'crm'], caseStudies: ['carter-roofing'],
  },
  {
    slug: 'plumbing', icon: 'droplet', group: 'home', enabled: true, featured: true,
    name: l('Plumbing', 'Plomería'), inlineName: l('plumbing', 'plomería'), tagline: l('Residential & commercial', 'Residencial y comercial'),
    heroDescription: l('Be the plumber customers call first with click-to-call, clear services and a CRM that never lets an emergency lead slip.', 'Sé el plomero al que llaman primero con clic para llamar, servicios claros y un CRM que no deja escapar ninguna urgencia.'),
    capabilities: { en: ['Click-to-call on every page', 'Emergency service banners', 'Service & pricing guides', 'Online booking requests'], es: ['Clic para llamar en cada página', 'Avisos de servicio urgente', 'Guías de servicios y precios', 'Solicitudes de reserva en línea'] },
    services: ['website-design', 'lead-capture', 'crm', 'hosting'],
  },
  {
    slug: 'electricians', icon: 'zap', group: 'home', enabled: true, featured: true,
    name: l('Electricians', 'Electricistas'), inlineName: l('electrical', 'electricidad'), tagline: l('Licensed electrical work', 'Trabajo eléctrico certificado'),
    heroDescription: l('Showcase licensing, safety and expertise while making it effortless to request a quote for panels, EV chargers and repairs.', 'Muestra licencias, seguridad y experiencia, y facilita cotizar paneles, cargadores eléctricos y reparaciones.'),
    capabilities: { en: ['License & insurance badges', 'Service-specific pages', 'Quote request forms', 'Commercial project pages'], es: ['Distintivos de licencia y seguro', 'Páginas por servicio', 'Formularios de cotización', 'Páginas de proyectos comerciales'] },
    services: ['website-design', 'lead-capture', 'crm', 'analytics'],
  },
  {
    slug: 'landscaping', icon: 'leaf', group: 'home', enabled: true, featured: true,
    name: l('Landscaping & Lawn Care', 'Paisajismo y jardinería'), inlineName: l('landscaping', 'paisajismo'), tagline: l('Design & maintenance', 'Diseño y mantenimiento'),
    heroDescription: l('Show off your best work and fill your schedule with recurring maintenance clients and seasonal projects.', 'Muestra tus mejores trabajos y llena tu agenda con clientes recurrentes y proyectos de temporada.'),
    capabilities: { en: ['Before & after galleries', 'Recurring service sign-ups', 'Seasonal promotions', 'Service area maps'], es: ['Galerías de antes y después', 'Registro de servicios recurrentes', 'Promociones de temporada', 'Mapas de zonas de servicio'] },
    services: ['website-design', 'campaigns', 'lead-capture', 'crm'],
  },
  {
    slug: 'painting', icon: 'paint', group: 'home', enabled: true, featured: true,
    name: l('Painting', 'Pintura'), inlineName: l('painting', 'pintura'), tagline: l('Interior & exterior', 'Interior y exterior'),
    heroDescription: l('Help homeowners and property managers picture the result and request an estimate in a few taps.', 'Ayuda a propietarios y administradores a imaginar el resultado y pedir un presupuesto en pocos toques.'),
    capabilities: { en: ['Project portfolios', 'Color consultation requests', 'Estimate forms', 'Commercial & residential pages'], es: ['Portafolios de proyectos', 'Solicitudes de asesoría de color', 'Formularios de presupuesto', 'Páginas comerciales y residenciales'] },
    services: ['website-design', 'lead-capture', 'domains', 'crm'],
  },
  {
    slug: 'general-contractors', icon: 'hammer', group: 'home', enabled: true, featured: true,
    name: l('General Contractors', 'Contratistas generales'), inlineName: l('contracting', 'construcción'), tagline: l('Build & renovate', 'Construcción y renovación'),
    heroDescription: l('Present your projects, process and credentials professionally to win larger, better-fit jobs.', 'Presenta tus proyectos, proceso y credenciales de forma profesional para ganar trabajos más grandes y adecuados.'),
    capabilities: { en: ['Project case pages', 'Process explanations', 'Bid request forms', 'Credentials & insurance'], es: ['Páginas de proyectos', 'Explicación del proceso', 'Formularios de licitación', 'Credenciales y seguros'] },
    services: ['website-design', 'crm', 'domains', 'maintenance'],
  },
  {
    slug: 'pest-control', icon: 'bug', group: 'home', enabled: true, featured: true,
    name: l('Pest Control', 'Control de plagas'), inlineName: l('pest control', 'control de plagas'), tagline: l('Residential & commercial', 'Residencial y comercial'),
    heroDescription: l('Capture urgent inspection requests and convert one-time treatments into recurring service plans.', 'Capta solicitudes urgentes de inspección y convierte tratamientos únicos en planes recurrentes.'),
    capabilities: { en: ['Pest identification pages', 'Inspection booking', 'Recurring plan sign-ups', 'Service reminders'], es: ['Páginas de identificación de plagas', 'Reserva de inspecciones', 'Registro de planes recurrentes', 'Recordatorios de servicio'] },
    services: ['lead-capture', 'campaigns', 'crm', 'website-design'],
  },
  {
    slug: 'home-builders', icon: 'building2', group: 'home', enabled: true, featured: true,
    name: l('Home Builders', 'Constructores de viviendas'), inlineName: l('home building', 'construcción de viviendas'), tagline: l('Custom & new construction', 'Obra nueva y a medida'),
    heroDescription: l('Showcase communities, floor plans and custom builds while nurturing long buying cycles in your CRM.', 'Muestra comunidades, planos y obras a medida mientras nutres largos ciclos de compra en tu CRM.'),
    capabilities: { en: ['Floor plan galleries', 'Community pages', 'Tour scheduling', 'Buyer nurture sequences'], es: ['Galerías de planos', 'Páginas de comunidades', 'Agenda de visitas', 'Secuencias para compradores'] },
    services: ['website-design', 'landing-pages', 'crm', 'campaigns'],
  },
  {
    slug: 'remodeling', icon: 'wrench', group: 'home', enabled: true, featured: true,
    name: l('Remodeling', 'Remodelación'), inlineName: l('remodeling', 'remodelación'), tagline: l('Kitchens, baths & more', 'Cocinas, baños y más'),
    heroDescription: l('Inspire homeowners with before-and-after work and guide them to a design consultation.', 'Inspira a los propietarios con trabajos de antes y después y guíalos a una consulta de diseño.'),
    capabilities: { en: ['Before & after galleries', 'Design consultation booking', 'Project cost guides', 'Financing information'], es: ['Galerías de antes y después', 'Reserva de consulta de diseño', 'Guías de costos', 'Información de financiamiento'] },
    services: ['website-redesign', 'lead-capture', 'crm', 'campaigns'],
  },
  {
    slug: 'interior-design', icon: 'sofa', group: 'professional', enabled: true, featured: true,
    name: l('Interior Design', 'Diseño de interiores'), inlineName: l('interior design', 'diseño de interiores'), tagline: l('Residential & commercial', 'Residencial y comercial'),
    heroDescription: l('A portfolio-first website that reflects your style and makes booking a consultation feel effortless.', 'Un sitio centrado en tu portafolio que refleja tu estilo y facilita reservar una consulta.'),
    capabilities: { en: ['Portfolio collections', 'Consultation booking', 'Style questionnaires', 'Press & publication pages'], es: ['Colecciones de portafolio', 'Reserva de consultas', 'Cuestionarios de estilo', 'Páginas de prensa'] },
    services: ['website-design', 'domains', 'ecommerce', 'crm'],
  },
  {
    slug: 'med-spas', icon: 'sparkles', group: 'health', enabled: true, featured: true,
    name: l('Med Spas & Aesthetics', 'Med spas y estética'), inlineName: l('med spa', 'med spa'), tagline: l('Treatments & memberships', 'Tratamientos y membresías'),
    heroDescription: l('Fill your appointment book with treatment pages, memberships and automated rebooking reminders.', 'Llena tu agenda con páginas de tratamientos, membresías y recordatorios automáticos.'),
    capabilities: { en: ['Treatment menus', 'Online booking requests', 'Membership pages', 'Rebooking reminders'], es: ['Menús de tratamientos', 'Solicitudes de reserva', 'Páginas de membresías', 'Recordatorios para volver'] },
    services: ['website-design', 'campaigns', 'crm', 'ecommerce'], caseStudies: ['luxe-aesthetics'],
  },
  {
    slug: 'clinical-research', icon: 'flask', group: 'health', enabled: true, featured: true,
    name: l('Clinical Research', 'Investigación clínica'), inlineName: l('clinical research', 'investigación clínica'), tagline: l('Sites & sponsors', 'Centros y patrocinadores'),
    heroDescription: l('Present studies clearly and route participant interest to your team with structured pre-screening forms.', 'Presenta estudios con claridad y dirige el interés de participantes a tu equipo con formularios de preselección.'),
    capabilities: { en: ['Study listing pages', 'Pre-screening forms', 'Multilingual participant pages', 'Sponsor information'], es: ['Páginas de estudios', 'Formularios de preselección', 'Páginas multilingües para participantes', 'Información para patrocinadores'] },
    services: ['website-design', 'lead-capture', 'hosting', 'maintenance'],
  },
  {
    slug: 'outpatient-medical', icon: 'stethoscope', group: 'health', enabled: true, featured: true,
    name: l('Outpatient Medical', 'Atención ambulatoria'), inlineName: l('outpatient medical', 'atención ambulatoria'), tagline: l('Clinics & practices', 'Clínicas y consultorios'),
    heroDescription: l('Help patients find the right provider, understand services and request appointments with confidence.', 'Ayuda a los pacientes a encontrar al profesional adecuado, entender servicios y pedir citas con confianza.'),
    capabilities: { en: ['Provider profiles', 'Service & condition pages', 'Appointment requests', 'Insurance information'], es: ['Perfiles de profesionales', 'Páginas de servicios', 'Solicitudes de cita', 'Información de seguros'] },
    services: ['website-design', 'hosting', 'maintenance', 'crm'],
  },
  {
    slug: 'dental', icon: 'smile', group: 'health', enabled: true, featured: true,
    name: l('Dental', 'Odontología'), inlineName: l('dental', 'odontología'), tagline: l('General & cosmetic', 'General y estética'),
    heroDescription: l('Attract new patients and keep existing ones on schedule with service pages and recall campaigns.', 'Atrae nuevos pacientes y mantén a los actuales al día con páginas de servicios y campañas de recordatorio.'),
    capabilities: { en: ['New patient forms', 'Service pages', 'Recall reminders', 'Insurance & financing'], es: ['Formularios de nuevos pacientes', 'Páginas de servicios', 'Recordatorios de revisión', 'Seguros y financiamiento'] },
    services: ['website-design', 'campaigns', 'crm', 'maintenance'],
  },
  {
    slug: 'legal', icon: 'scale', group: 'professional', enabled: true, featured: true,
    name: l('Legal', 'Legal'), inlineName: l('law firm', 'despachos legales'), tagline: l('Firms & practitioners', 'Despachos y abogados'),
    heroDescription: l('Build credibility with practice area pages and route consultation requests into an organized intake pipeline.', 'Genera credibilidad con páginas por área de práctica y organiza las consultas en un embudo de admisión.'),
    capabilities: { en: ['Practice area pages', 'Attorney profiles', 'Consultation intake', 'Multilingual content'], es: ['Páginas por área de práctica', 'Perfiles de abogados', 'Admisión de consultas', 'Contenido multilingüe'] },
    services: ['website-design', 'crm', 'lead-capture', 'hosting'],
  },
  {
    slug: 'real-estate', icon: 'building', group: 'professional', enabled: true, featured: true,
    name: l('Real Estate', 'Bienes raíces'), inlineName: l('real estate', 'bienes raíces'), tagline: l('Agents & brokerages', 'Agentes e inmobiliarias'),
    heroDescription: l('Capture buyer and seller leads with neighborhood pages and nurture them over long timelines in your CRM.', 'Capta compradores y vendedores con páginas de vecindarios y nútrelos a largo plazo en tu CRM.'),
    capabilities: { en: ['Neighborhood guides', 'Home valuation requests', 'Agent profiles', 'Lead nurture sequences'], es: ['Guías de vecindarios', 'Solicitudes de valuación', 'Perfiles de agentes', 'Secuencias de seguimiento'] },
    services: ['website-redesign', 'crm', 'campaigns', 'landing-pages'],
  },
  {
    slug: 'restaurants', icon: 'utensils', group: 'hospitality', enabled: true, featured: true,
    name: l('Restaurants', 'Restaurantes'), inlineName: l('restaurant', 'restaurantes'), tagline: l('Dining & catering', 'Comedor y catering'),
    heroDescription: l('Menus, reservations, catering inquiries and promotions — in a fast site that looks great on phones.', 'Menús, reservas, consultas de catering y promociones, en un sitio rápido que luce bien en móviles.'),
    capabilities: { en: ['Mobile-first menus', 'Reservation links', 'Catering inquiry forms', 'Promotions & events'], es: ['Menús para móvil', 'Enlaces de reserva', 'Formularios de catering', 'Promociones y eventos'] },
    services: ['website-design', 'campaigns', 'ecommerce', 'analytics'],
  },
  {
    slug: 'automotive', icon: 'car', group: 'hospitality', enabled: true, featured: true,
    name: l('Automotive', 'Automotriz'), inlineName: l('automotive', 'automotriz'), tagline: l('Repair & detailing', 'Taller y detallado'),
    heroDescription: l('Book more service appointments and bring customers back with maintenance reminders.', 'Agenda más citas de servicio y haz que los clientes vuelvan con recordatorios de mantenimiento.'),
    capabilities: { en: ['Service menus', 'Appointment requests', 'Maintenance reminders', 'Reviews display'], es: ['Menús de servicios', 'Solicitudes de cita', 'Recordatorios de mantenimiento', 'Muestra de reseñas'] },
    services: ['website-design', 'campaigns', 'crm', 'lead-capture'],
  },
  {
    slug: 'financial-services', icon: 'landmark', group: 'professional', enabled: true, featured: true,
    name: l('Financial Services', 'Servicios financieros'), inlineName: l('financial services', 'servicios financieros'), tagline: l('Advisors, tax & insurance', 'Asesores, impuestos y seguros'),
    heroDescription: l('Communicate trust and expertise, and turn educational content into consultation requests.', 'Comunica confianza y experiencia, y convierte contenido educativo en solicitudes de consulta.'),
    capabilities: { en: ['Advisor profiles', 'Educational resources', 'Consultation booking', 'Secure contact options'], es: ['Perfiles de asesores', 'Recursos educativos', 'Reserva de consultas', 'Opciones de contacto seguras'] },
    services: ['website-redesign', 'crm', 'analytics', 'hosting'],
  },
]

export function getIndustries(): Industry[] {
  return industries.filter((i) => i.enabled)
}

export function getIndustry(slug: string): Industry | undefined {
  return getIndustries().find((i) => i.slug === slug)
}

export function getIndustriesBySlugs(slugs: string[]): Industry[] {
  return slugs.map((s) => getIndustry(s)).filter((i): i is Industry => Boolean(i))
}

export function getRelatedIndustries(industry: Industry, count = 4): Industry[] {
  const same = getIndustries().filter((i) => i.slug !== industry.slug && i.group === industry.group)
  const others = getIndustries().filter((i) => i.slug !== industry.slug && i.group !== industry.group)
  return [...same, ...others].slice(0, count)
}
