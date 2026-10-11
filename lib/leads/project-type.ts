import type { ProjectType } from '@prisma/client'

export function mapIntakeProjectType(value: string | undefined): ProjectType {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized.includes('ecommerce') || normalized.includes('e-commerce') || normalized.includes('shop')) {
    return 'ECOMMERCE'
  }
  if (normalized.includes('redesign')) return 'REDESIGN'
  if (normalized.includes('landing')) return 'LANDING'
  if (normalized.includes('crm')) return 'CRM'
  if (normalized.includes('other')) return 'OTHER'
  return 'WEBSITE'
}
