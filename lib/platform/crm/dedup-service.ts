import { prisma } from '@/lib/db'
import type { CrmResult } from '@/lib/platform/crm/types'

export async function findDuplicateCandidatesWithinAccount(customerAccountId: string, emailNormalized: string) {
  return prisma.crmContactChannelIdentity.findMany({
    where: { customerAccountId, identityType: 'EMAIL', normalizedValue: emailNormalized },
    include: { contact: true },
  })
}

export async function proposeContactMerge(input: {
  customerAccountId: string
  primaryContactId: string
  duplicateContactId: string
  confidenceBps: number
}): Promise<CrmResult<{ id: string }>> {
  const [primary, duplicate] = await Promise.all([
    prisma.crmContact.findFirst({ where: { id: input.primaryContactId, customerAccountId: input.customerAccountId } }),
    prisma.crmContact.findFirst({ where: { id: input.duplicateContactId, customerAccountId: input.customerAccountId } }),
  ])
  if (!primary || !duplicate) return { ok: false, code: 'NOT_FOUND', message: 'Merge contacts not found' }
  if (primary.customerAccountId !== duplicate.customerAccountId) {
    return { ok: false, code: 'CROSS_ACCOUNT_DENIED', message: 'Cross-account merge denied' }
  }
  const row = await prisma.crmMergeProposal.create({
    data: {
      customerAccountId: input.customerAccountId,
      primaryContactId: input.primaryContactId,
      duplicateContactId: input.duplicateContactId,
      confidenceBps: input.confidenceBps,
    },
  })
  return { ok: true, value: { id: row.id } }
}

export async function rejectCrossAccountMerge(
  accountA: string,
  accountB: string,
): Promise<CrmResult<true>> {
  if (accountA !== accountB) {
    return { ok: false, code: 'CROSS_ACCOUNT_DENIED', message: 'Cross-account merge denied' }
  }
  return { ok: true, value: true }
}
