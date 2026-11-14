import type { InfrastructureDataSource } from '@prisma/client'

export function dataSourceCustomerLabel(source: InfrastructureDataSource, locale: 'en' | 'es'): string {
  if (source === 'PROVIDER_VERIFIED') {
    return locale === 'es' ? 'Verificado con proveedor' : 'Provider verified'
  }
  return locale === 'es' ? 'Registro administrativo' : 'Administrative record'
}

export function formatNameservers(value: unknown): string | null {
  if (value == null) return null
  if (Array.isArray(value)) {
    const parts = value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    return parts.length > 0 ? parts.join(', ') : null
  }
  return null
}

export function formatOptionalDate(value: Date | null | undefined, locale: 'en' | 'es'): string | null {
  if (!value) return null
  return value.toLocaleDateString(locale === 'es' ? 'es-US' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
