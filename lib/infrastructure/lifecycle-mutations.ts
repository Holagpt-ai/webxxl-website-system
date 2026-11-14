import { prisma } from '@/lib/db'
import type {
  BusinessEmailServiceStatus,
  DomainRenewalStatus,
  DomainVerificationStatus,
  HostingServiceStatus,
} from '@prisma/client'

export type LifecycleMutationError = 'missing_id' | 'invalid_status' | 'not_found' | 'unauthorized' | 'transaction_failed'

export type LifecycleMutationResult = { ok: true } | { ok: false; error: LifecycleMutationError }

export async function applyHostingLifecycleStatus(input: {
  hostingId: string
  status: HostingServiceStatus
  actorUserId: string
}): Promise<LifecycleMutationResult> {
  const existing = await prisma.hostingService.findUnique({
    where: { id: input.hostingId },
    select: { id: true, customerAccountId: true },
  })
  if (!existing) return { ok: false, error: 'not_found' }

  try {
    await prisma.$transaction([
      prisma.hostingService.update({
        where: { id: input.hostingId },
        data: { status: input.status },
      }),
      prisma.infrastructureActivity.create({
        data: {
          assetType: 'HOSTING',
          assetId: input.hostingId,
          customerAccountId: existing.customerAccountId,
          actorUserId: input.actorUserId,
          summary: `Hosting status updated to ${input.status}`,
        },
      }),
    ])
    return { ok: true }
  } catch {
    return { ok: false, error: 'transaction_failed' }
  }
}

export async function applyDomainLifecycleStatus(input: {
  domainId: string
  verificationStatus: DomainVerificationStatus
  renewalStatus: DomainRenewalStatus
  actorUserId: string
}): Promise<LifecycleMutationResult> {
  const existing = await prisma.managedDomain.findUnique({
    where: { id: input.domainId },
    select: { id: true, customerAccountId: true },
  })
  if (!existing) return { ok: false, error: 'not_found' }

  try {
    await prisma.$transaction([
      prisma.managedDomain.update({
        where: { id: input.domainId },
        data: {
          verificationStatus: input.verificationStatus,
          renewalStatus: input.renewalStatus,
        },
      }),
      prisma.infrastructureActivity.create({
        data: {
          assetType: 'DOMAIN',
          assetId: input.domainId,
          customerAccountId: existing.customerAccountId,
          actorUserId: input.actorUserId,
          summary: `Domain lifecycle updated (verification ${input.verificationStatus}, renewal ${input.renewalStatus}; no DNS writes)`,
        },
      }),
    ])
    return { ok: true }
  } catch {
    return { ok: false, error: 'transaction_failed' }
  }
}

export async function applyEmailLifecycleStatus(input: {
  emailId: string
  status: BusinessEmailServiceStatus
  actorUserId: string
}): Promise<LifecycleMutationResult> {
  const existing = await prisma.businessEmailService.findUnique({
    where: { id: input.emailId },
    select: { id: true, customerAccountId: true },
  })
  if (!existing) return { ok: false, error: 'not_found' }

  try {
    await prisma.$transaction([
      prisma.businessEmailService.update({
        where: { id: input.emailId },
        data: { status: input.status },
      }),
      prisma.infrastructureActivity.create({
        data: {
          assetType: 'EMAIL',
          assetId: input.emailId,
          customerAccountId: existing.customerAccountId,
          actorUserId: input.actorUserId,
          summary: `Business email status updated to ${input.status}`,
        },
      }),
    ])
    return { ok: true }
  } catch {
    return { ok: false, error: 'transaction_failed' }
  }
}