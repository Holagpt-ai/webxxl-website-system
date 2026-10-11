import { prisma } from '@/lib/db'
import type {
  BusinessEmailServiceStatus,
  DomainRenewalStatus,
  DomainVerificationStatus,
  HostingServiceStatus,
  HostingSslStatus,
  InfrastructureDataSource,
  InfrastructureManagementMode,
  Prisma,
} from '@prisma/client'
import { normalizeDomainName } from '@/lib/infrastructure/domain'
import { buildDomainPublicId, buildEmailPublicId, buildHostingPublicId } from '@/lib/infrastructure/ids'
import { writeInfrastructureActivity } from '@/lib/infrastructure/activity'
import { getDnsProvider, getDomainRegistrarProvider, getEmailProvider, getHostingProvider } from '@/lib/infrastructure/providers/stubs'

export async function registerManagedDomain(input: {
  customerAccountId: string
  domainName: string
  actorUserId: string
  registrar?: string | null
  registeredAt?: Date | null
  expiresAt?: Date | null
  renewalStatus?: DomainRenewalStatus
  nameservers?: Prisma.InputJsonValue
  dnsProviderId?: string | null
  verificationStatus?: DomainVerificationStatus
  dataSource?: InfrastructureDataSource
  providerReference?: string | null
  internalNotes?: string | null
}) {
  const normalized = normalizeDomainName(input.domainName)
  if (!normalized) return { ok: false as const, error: 'invalid_domain' }

  const existing = await prisma.managedDomain.findUnique({
    where: { customerAccountId_domainName: { customerAccountId: input.customerAccountId, domainName: normalized } },
  })
  if (existing) return { ok: false as const, error: 'duplicate_domain' }

  const domain = await prisma.managedDomain.create({
    data: {
      publicId: buildDomainPublicId(),
      customerAccountId: input.customerAccountId,
      domainName: normalized,
      registrar: input.registrar?.trim() || null,
      registeredAt: input.registeredAt ?? null,
      expiresAt: input.expiresAt ?? null,
      renewalStatus: input.renewalStatus ?? 'UNKNOWN',
      nameservers: input.nameservers ?? undefined,
      dnsProviderId: input.dnsProviderId?.trim() || null,
      verificationStatus: input.verificationStatus ?? 'UNVERIFIED',
      dataSource: input.dataSource ?? 'MANUAL',
      providerReference: input.providerReference?.trim() || null,
      internalNotes: input.internalNotes?.trim() || null,
    },
  })

  await writeInfrastructureActivity({
    assetType: 'DOMAIN',
    assetId: domain.id,
    customerAccountId: input.customerAccountId,
    actorUserId: input.actorUserId,
    summary: `Domain registered: ${domain.domainName}`,
  })

  return { ok: true as const, domain }
}

export async function registerHostingService(input: {
  customerAccountId: string
  actorUserId: string
  providerId: string
  projectId?: string | null
  managedDomainId?: string | null
  externalProviderRef?: string | null
  planLabel?: string | null
  primaryDomain?: string | null
  status?: HostingServiceStatus
  startedAt?: Date | null
  renewsAt?: Date | null
  sslStatus?: HostingSslStatus
  managementMode?: InfrastructureManagementMode
  dataSource?: InfrastructureDataSource
  notes?: string | null
  internalNotes?: string | null
}) {
  if (input.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, customerAccountId: input.customerAccountId },
    })
    if (!project) return { ok: false as const, error: 'invalid_project' }
  }
  if (input.managedDomainId) {
    const domain = await prisma.managedDomain.findFirst({
      where: { id: input.managedDomainId, customerAccountId: input.customerAccountId },
    })
    if (!domain) return { ok: false as const, error: 'invalid_domain' }
  }
  let primaryDomain = input.primaryDomain?.trim() || null
  if (primaryDomain) {
    primaryDomain = normalizeDomainName(primaryDomain)
    if (!primaryDomain) return { ok: false as const, error: 'invalid_domain' }
  }

  const hosting = await prisma.hostingService.create({
    data: {
      publicId: buildHostingPublicId(),
      customerAccountId: input.customerAccountId,
      projectId: input.projectId ?? null,
      managedDomainId: input.managedDomainId ?? null,
      providerId: input.providerId.trim() || 'manual',
      externalProviderRef: input.externalProviderRef?.trim() || null,
      planLabel: input.planLabel?.trim() || null,
      primaryDomain,
      status: input.status ?? 'PENDING',
      startedAt: input.startedAt ?? null,
      renewsAt: input.renewsAt ?? null,
      sslStatus: input.sslStatus ?? 'UNKNOWN',
      managementMode: input.managementMode ?? 'MANUAL',
      dataSource: input.dataSource ?? 'MANUAL',
      notes: input.notes?.trim() || null,
      internalNotes: input.internalNotes?.trim() || null,
    },
  })

  await writeInfrastructureActivity({
    assetType: 'HOSTING',
    assetId: hosting.id,
    customerAccountId: input.customerAccountId,
    actorUserId: input.actorUserId,
    summary: `Hosting service registered (${hosting.publicId})`,
  })

  return { ok: true as const, hosting }
}

export async function registerBusinessEmailService(input: {
  customerAccountId: string
  actorUserId: string
  providerId: string
  managedDomainId?: string | null
  planLabel?: string | null
  mailboxCount?: number
  renewsAt?: Date | null
  status?: BusinessEmailServiceStatus
  externalProviderRef?: string | null
  dataSource?: InfrastructureDataSource
  internalNotes?: string | null
}) {
  if (input.managedDomainId) {
    const domain = await prisma.managedDomain.findFirst({
      where: { id: input.managedDomainId, customerAccountId: input.customerAccountId },
    })
    if (!domain) return { ok: false as const, error: 'invalid_domain' }
  }

  const email = await prisma.businessEmailService.create({
    data: {
      publicId: buildEmailPublicId(),
      customerAccountId: input.customerAccountId,
      managedDomainId: input.managedDomainId ?? null,
      providerId: input.providerId.trim() || 'manual',
      planLabel: input.planLabel?.trim() || null,
      mailboxCount: Math.max(0, input.mailboxCount ?? 0),
      renewsAt: input.renewsAt ?? null,
      status: input.status ?? 'PENDING',
      externalProviderRef: input.externalProviderRef?.trim() || null,
      dataSource: input.dataSource ?? 'MANUAL',
      internalNotes: input.internalNotes?.trim() || null,
    },
  })

  await writeInfrastructureActivity({
    assetType: 'EMAIL',
    assetId: email.id,
    customerAccountId: input.customerAccountId,
    actorUserId: input.actorUserId,
    summary: `Business email registered (${email.publicId})`,
  })

  return { ok: true as const, email }
}

export async function markInfrastructureSyncRequested(input: {
  assetType: 'HOSTING' | 'DOMAIN' | 'EMAIL'
  assetId: string
  actorUserId: string
}) {
  const now = new Date()
  if (input.assetType === 'HOSTING') {
    const row = await prisma.hostingService.update({
      where: { id: input.assetId },
      data: { syncRequestedAt: now, managementMode: 'PROVIDER_SYNC_READY' },
    })
    await writeInfrastructureActivity({
      assetType: 'HOSTING',
      assetId: row.id,
      customerAccountId: row.customerAccountId,
      actorUserId: input.actorUserId,
      summary: 'Marked for future provider synchronization',
    })
    return { ok: true as const }
  }
  if (input.assetType === 'DOMAIN') {
    const row = await prisma.managedDomain.update({
      where: { id: input.assetId },
      data: { syncRequestedAt: now },
    })
    await writeInfrastructureActivity({
      assetType: 'DOMAIN',
      assetId: row.id,
      customerAccountId: row.customerAccountId,
      actorUserId: input.actorUserId,
      summary: 'Marked for future provider synchronization',
    })
    return { ok: true as const }
  }
  const row = await prisma.businessEmailService.update({
    where: { id: input.assetId },
    data: { syncRequestedAt: now },
  })
  await writeInfrastructureActivity({
    assetType: 'EMAIL',
    assetId: row.id,
    customerAccountId: row.customerAccountId,
    actorUserId: input.actorUserId,
    summary: 'Marked for future provider synchronization',
  })
  return { ok: true as const }
}

/** Read-only probe — never mutates external systems. */
export async function probeProviderReadOnly(input: {
  kind: 'hosting' | 'registrar' | 'dns' | 'email'
  providerId: string
  externalRef?: string
  domain?: string
}) {
  if (input.kind === 'hosting') {
    const provider = getHostingProvider(input.providerId)
    if (!input.externalRef) return { ok: false as const, error: 'missing_ref' }
    return provider.fetchServiceInfo(input.externalRef)
  }
  if (input.kind === 'registrar') {
    const provider = getDomainRegistrarProvider(input.providerId)
    if (!input.externalRef) return { ok: false as const, error: 'missing_ref' }
    return provider.fetchDomainInfo(input.externalRef)
  }
  if (input.kind === 'dns') {
    const provider = getDnsProvider(input.providerId)
    if (!input.domain) return { ok: false as const, error: 'missing_domain' }
    return provider.fetchDnsRecords(input.domain)
  }
  const provider = getEmailProvider(input.providerId)
  if (!input.externalRef) return { ok: false as const, error: 'missing_ref' }
  return provider.fetchMailboxInfo(input.externalRef)
}
