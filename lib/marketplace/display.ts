import type { ServiceOrderStatus } from '@prisma/client'
import { getMarketplaceService, localizedMarketplaceText } from '@/lib/marketplace/catalog'

export function resolveMarketplaceServiceDisplayName(serviceKey: string, locale: 'en' | 'es'): string {
  const definition = getMarketplaceService(serviceKey)
  if (definition) return localizedMarketplaceText(definition.name, locale)
  if (locale === 'es') return `Servicio (${serviceKey})`
  return `Service (${serviceKey})`
}

export type MarketplaceOrderStatusLabels = Partial<Record<ServiceOrderStatus, string>>

export function resolveServiceOrderStatusLabel(
  status: string,
  labels: MarketplaceOrderStatusLabels,
  locale: 'en' | 'es',
): string {
  const mapped = labels[status as ServiceOrderStatus]
  if (mapped) return mapped
  return locale === 'es' ? status : status.replace(/_/g, ' ').toLowerCase()
}

/** Prevents overlapping submits from rapid double-clicks. */
export function acquireMarketplaceSubmitLock(isLocked: boolean): { allowed: boolean; nextLocked: boolean } {
  if (isLocked) return { allowed: false, nextLocked: true }
  return { allowed: true, nextLocked: true }
}

export function releaseMarketplaceSubmitLock(): boolean {
  return false
}
