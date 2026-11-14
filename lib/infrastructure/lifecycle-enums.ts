import type {
  BusinessEmailServiceStatus,
  DomainRenewalStatus,
  DomainVerificationStatus,
  HostingServiceStatus,
} from '@prisma/client'

/** Approved Prisma enum values — runtime validation (not client-only). */
export const HOSTING_SERVICE_STATUS_VALUES = [
  'ACTIVE',
  'PENDING',
  'SUSPENDED',
  'CANCELLED',
  'UNKNOWN',
] as const satisfies readonly HostingServiceStatus[]

export const DOMAIN_VERIFICATION_STATUS_VALUES = ['UNVERIFIED', 'PENDING', 'VERIFIED'] as const satisfies readonly DomainVerificationStatus[]

export const DOMAIN_RENEWAL_STATUS_VALUES = ['UNKNOWN', 'AUTO', 'MANUAL', 'PENDING', 'EXPIRED'] as const satisfies readonly DomainRenewalStatus[]

export const BUSINESS_EMAIL_STATUS_VALUES = [
  'ACTIVE',
  'PENDING',
  'SUSPENDED',
  'CANCELLED',
  'UNKNOWN',
] as const satisfies readonly BusinessEmailServiceStatus[]

const hostingSet = new Set<string>(HOSTING_SERVICE_STATUS_VALUES)
const domainVerificationSet = new Set<string>(DOMAIN_VERIFICATION_STATUS_VALUES)
const domainRenewalSet = new Set<string>(DOMAIN_RENEWAL_STATUS_VALUES)
const emailSet = new Set<string>(BUSINESS_EMAIL_STATUS_VALUES)

export function parseHostingServiceStatus(raw: string): HostingServiceStatus | null {
  const v = raw.trim()
  return hostingSet.has(v) ? (v as HostingServiceStatus) : null
}

export function parseDomainVerificationStatus(raw: string): DomainVerificationStatus | null {
  const v = raw.trim()
  return domainVerificationSet.has(v) ? (v as DomainVerificationStatus) : null
}

export function parseDomainRenewalStatus(raw: string): DomainRenewalStatus | null {
  const v = raw.trim()
  return domainRenewalSet.has(v) ? (v as DomainRenewalStatus) : null
}

export function parseBusinessEmailServiceStatus(raw: string): BusinessEmailServiceStatus | null {
  const v = raw.trim()
  return emailSet.has(v) ? (v as BusinessEmailServiceStatus) : null
}