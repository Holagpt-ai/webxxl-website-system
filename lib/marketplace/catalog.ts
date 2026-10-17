import type { FeatureFlag } from '@/config/features'
import { isEnabled } from '@/config/features'
export type ServiceBillingClass = 'ONE_TIME' | 'RECURRING'
export type ServicePricingMode = 'INCLUDED_FREE' | 'RECURRING' | 'ONE_TIME' | 'METERED_EXTERNAL'
export type FreeServiceEligibilityCohort = 'UNRESOLVED' | 'SUBSCRIBER_ONLY' | 'ALL_SIGNUPS' | 'HYBRID'
export type MarketplaceServiceAvailability = 'AVAILABLE' | 'COMING_SOON' | 'UNAVAILABLE'

export type MarketplaceCategory =
  | 'WEBSITE_ENHANCEMENTS'
  | 'SEO_LOCAL'
  | 'AI_CHAT'
  | 'CRM_AUTOMATION'
  | 'HOSTING_DOMAINS_EMAIL'
  | 'ECOMMERCE'
  | 'MAINTENANCE_SUPPORT'
  | 'MARKETING_ADS'

export type MarketplaceServiceDefinition = {
  serviceKey: string
  category: MarketplaceCategory
  name: { en: string; es: string }
  description: { en: string; es: string }
  inclusions: { en: string[]; es: string[] }
  iconRef?: string
  pricingPresentation: { en: string; es: string }
  billingClass: ServiceBillingClass
  /** Forward-looking classification. Does not change historical quotes or displayed catalog prices. */
  pricingMode?: ServicePricingMode
  eligibleSubscriberCohort?: FreeServiceEligibilityCohort
  availability: MarketplaceServiceAvailability
  requiresProject: boolean
  /** When fulfilled, may map to CustomerService.serviceKey from the portal registry. */
  registryEntitlementKey?: string
  featureFlag?: FeatureFlag
  enabled: boolean
}

export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [
  'WEBSITE_ENHANCEMENTS',
  'SEO_LOCAL',
  'AI_CHAT',
  'CRM_AUTOMATION',
  'HOSTING_DOMAINS_EMAIL',
  'ECOMMERCE',
  'MAINTENANCE_SUPPORT',
  'MARKETING_ADS',
]

const catalog: MarketplaceServiceDefinition[] = [
  {
    serviceKey: 'marketplace.website-new-page',
    category: 'WEBSITE_ENHANCEMENTS',
    name: { en: 'New page or section', es: 'Nueva página o sección' },
    description: {
      en: 'Add a focused page or section to your website with WebXXL design and copy support.',
      es: 'Agrega una página o sección enfocada con diseño y redacción de WebXXL.',
    },
    inclusions: {
      en: ['Structure and layout', 'Copy draft for review', 'Launch coordination'],
      es: ['Estructura y diseño', 'Borrador de texto para revisión', 'Coordinación de publicación'],
    },
    iconRef: 'layers',
    pricingPresentation: { en: 'Custom quote after review', es: 'Cotización personalizada tras revisión' },
    billingClass: 'ONE_TIME',
    availability: 'AVAILABLE',
    requiresProject: true,
    enabled: true,
  },
  {
    serviceKey: 'marketplace.seo-local',
    category: 'SEO_LOCAL',
    name: { en: 'SEO & local visibility', es: 'SEO y visibilidad local' },
    description: {
      en: 'Improve search visibility and local presence with structured updates and recommendations.',
      es: 'Mejora la visibilidad en búsqueda y presencia local con actualizaciones estructuradas.',
    },
    inclusions: {
      en: ['On-page recommendations', 'Local listing guidance', 'Progress reporting'],
      es: ['Recomendaciones on-page', 'Guía para fichas locales', 'Informes de progreso'],
    },
    iconRef: 'search',
    pricingPresentation: { en: 'Monthly or project quote', es: 'Cotización mensual o por proyecto' },
    billingClass: 'RECURRING',
    availability: 'AVAILABLE',
    requiresProject: true,
    registryEntitlementKey: 'seo',
    enabled: true,
  },
  {
    serviceKey: 'marketplace.ai-receptionist',
    category: 'AI_CHAT',
    name: { en: 'AI chat & receptionist', es: 'Chat y recepcionista con IA' },
    description: {
      en: 'Explore AI-assisted chat or receptionist experiences scoped to your business rules.',
      es: 'Explora chat o recepcionista con IA acorde a las reglas de tu negocio.',
    },
    inclusions: {
      en: ['Use-case review', 'Safe rollout plan', 'No auto-publish without approval'],
      es: ['Revisión de casos de uso', 'Plan de implementación seguro', 'Sin publicación automática sin aprobación'],
    },
    iconRef: 'sparkles',
    pricingPresentation: { en: 'Quote based on scope', es: 'Cotización según alcance' },
    billingClass: 'RECURRING',
    availability: 'COMING_SOON',
    requiresProject: false,
    registryEntitlementKey: 'ai',
    featureFlag: 'aiServices',
    enabled: true,
  },
  {
    serviceKey: 'marketplace.crm-automation',
    category: 'CRM_AUTOMATION',
    name: { en: 'CRM & follow-up automation', es: 'CRM y automatización de seguimiento' },
    description: {
      en: 'Extend CRM workflows, pipelines, or follow-up sequences with WebXXL configuration.',
      es: 'Extiende flujos de CRM, pipelines o secuencias de seguimiento con configuración WebXXL.',
    },
    inclusions: {
      en: ['Workflow design session', 'Implementation plan', 'Customer training handoff'],
      es: ['Sesión de diseño de flujos', 'Plan de implementación', 'Entrenamiento al cliente'],
    },
    iconRef: 'contact',
    pricingPresentation: { en: 'Custom quote', es: 'Cotización personalizada' },
    billingClass: 'RECURRING',
    availability: 'AVAILABLE',
    requiresProject: false,
    registryEntitlementKey: 'crm',
    enabled: true,
  },
  {
    serviceKey: 'marketplace.hosting-email',
    category: 'HOSTING_DOMAINS_EMAIL',
    name: { en: 'Hosting, domain, or email add-on', es: 'Complemento de hosting, dominio o correo' },
    description: {
      en: 'Request additional hosting capacity, domain management, or business email mailboxes.',
      es: 'Solicita capacidad de hosting, gestión de dominio o buzones de correo empresarial.',
    },
    inclusions: {
      en: ['DNS or mailbox scoping', 'Migration checklist if needed', 'Activation by WebXXL only'],
      es: ['Alcance de DNS o buzones', 'Lista de migración si aplica', 'Activación solo por WebXXL'],
    },
    iconRef: 'server',
    pricingPresentation: { en: 'Quoted before activation', es: 'Cotizado antes de activar' },
    billingClass: 'RECURRING',
    availability: 'AVAILABLE',
    requiresProject: false,
    registryEntitlementKey: 'hosting',
    enabled: true,
  },
  {
    serviceKey: 'marketplace.ecommerce-upgrade',
    category: 'ECOMMERCE',
    name: { en: 'Ecommerce upgrade', es: 'Mejora de ecommerce' },
    description: {
      en: 'Expand catalog, checkout, or merchandising capabilities on your WebXXL site.',
      es: 'Amplía catálogo, checkout o merchandising en tu sitio WebXXL.',
    },
    inclusions: {
      en: ['Scope review', 'Staged rollout plan', 'QA before go-live'],
      es: ['Revisión de alcance', 'Plan por etapas', 'QA antes de publicar'],
    },
    iconRef: 'cart',
    pricingPresentation: { en: 'Project-based quote', es: 'Cotización por proyecto' },
    billingClass: 'ONE_TIME',
    availability: 'AVAILABLE',
    requiresProject: true,
    registryEntitlementKey: 'ecommerce',
    enabled: true,
  },
  {
    serviceKey: 'marketplace.maintenance',
    category: 'MAINTENANCE_SUPPORT',
    name: { en: 'Maintenance & support block', es: 'Bloque de mantenimiento y soporte' },
    description: {
      en: 'Priority content updates, monitoring, or support hours beyond your current plan.',
      es: 'Actualizaciones prioritarias, monitoreo o horas de soporte más allá de tu plan actual.',
    },
    inclusions: {
      en: ['Defined response targets', 'Change log', 'No payment until quote approved'],
      es: ['Objetivos de respuesta definidos', 'Registro de cambios', 'Sin pago hasta aprobar cotización'],
    },
    iconRef: 'lifebuoy',
    pricingPresentation: { en: 'Recurring or prepaid blocks', es: 'Recurrente o bloques prepago' },
    billingClass: 'RECURRING',
    availability: 'AVAILABLE',
    requiresProject: false,
    enabled: true,
  },
  {
    serviceKey: 'marketplace.marketing-ads',
    category: 'MARKETING_ADS',
    name: { en: 'Marketing & ad campaigns', es: 'Marketing y campañas publicitarias' },
    description: {
      en: 'Landing pages, campaign setup, or ad creative coordinated with your WebXXL team.',
      es: 'Landing pages, configuración de campañas o creativos coordinados con tu equipo WebXXL.',
    },
    inclusions: {
      en: ['Campaign brief', 'Creative review cycles', 'Performance check-ins'],
      es: ['Brief de campaña', 'Ciclos de revisión creativa', 'Seguimiento de resultados'],
    },
    iconRef: 'megaphone',
    pricingPresentation: { en: 'Quote per campaign', es: 'Cotización por campaña' },
    billingClass: 'ONE_TIME',
    availability: 'AVAILABLE',
    requiresProject: true,
    registryEntitlementKey: 'scheduler',
    enabled: true,
  },
]

export function getMarketplaceCatalog(): MarketplaceServiceDefinition[] {
  return catalog
}

export function getMarketplaceService(serviceKey: string): MarketplaceServiceDefinition | undefined {
  return catalog.find((item) => item.serviceKey === serviceKey)
}

export function isMarketplaceServiceVisible(def: MarketplaceServiceDefinition): boolean {
  if (!isEnabled('serviceMarketplace')) return false
  if (!def.enabled) return false
  if (def.featureFlag && !isEnabled(def.featureFlag)) return false
  return true
}

export function listVisibleMarketplaceServices(): MarketplaceServiceDefinition[] {
  return catalog.filter(isMarketplaceServiceVisible)
}

export function localizedMarketplaceText<T extends { en: string; es: string }>(value: T, locale: 'en' | 'es'): string {
  return locale === 'es' ? value.es : value.en
}
