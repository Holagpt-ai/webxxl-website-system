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
  if (input.primaryContactId === input.duplicateContactId) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Merge contacts must be distinct' }
  }
  const [primary, duplicate] = await Promise.all([
    prisma.crmContact.findFirst({ where: { id: input.primaryContactId, customerAccountId: input.customerAccountId } }),
    prisma.crmContact.findFirst({ where: { id: input.duplicateContactId, customerAccountId: input.customerAccountId } }),
  ])
  if (!primary || !duplicate) return { ok: false, code: 'NOT_FOUND', message: 'Merge contacts not found' }
  if (primary.status !== 'ACTIVE' || duplicate.status !== 'ACTIVE') {
    return { ok: false, code: 'CONFLICT', message: 'Only active contacts can be merged' }
  }
  if (primary.customerAccountId !== duplicate.customerAccountId) {
    return { ok: false, code: 'CROSS_ACCOUNT_DENIED', message: 'Cross-account merge denied' }
  }
  const row = await prisma.crmMergeProposal.create({
    data: {
      customerAccountId: input.customerAccountId,
      primaryContactId: input.primaryContactId,
      duplicateContactId: input.duplicateContactId,
      confidenceBps: input.confidenceBps,
      status: 'PENDING',
    },
  })
  return { ok: true, value: { id: row.id } }
}

export async function listMergeProposals(customerAccountId: string, status = 'PENDING') {
  return prisma.crmMergeProposal.findMany({
    where: { customerAccountId, status },
    orderBy: { createdAt: 'desc' },
  })
}

export async function rejectMergeProposal(input: {
  customerAccountId: string
  proposalId: string
  actorUserId: string
}): Promise<CrmResult<true>> {
  const proposal = await prisma.crmMergeProposal.findFirst({
    where: { id: input.proposalId, customerAccountId: input.customerAccountId },
  })
  if (!proposal) return { ok: false, code: 'NOT_FOUND', message: 'Merge proposal not found' }
  if (proposal.status !== 'PENDING') {
    return { ok: false, code: 'CONFLICT', message: 'Merge proposal is not pending' }
  }
  await prisma.crmMergeProposal.update({
    where: { id: proposal.id },
    data: { status: 'REJECTED' },
  })
  return { ok: true, value: true }
}

async function reassignContactChildren(
  tx: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  customerAccountId: string,
  fromContactId: string,
  toContactId: string,
) {
  await tx.crmTimelineEvent.updateMany({ where: { customerAccountId, contactId: fromContactId }, data: { contactId: toContactId } })
  await tx.crmContactNote.updateMany({ where: { customerAccountId, contactId: fromContactId }, data: { contactId: toContactId } })
  await tx.crmTask.updateMany({ where: { customerAccountId, contactId: fromContactId }, data: { contactId: toContactId } })
  await tx.crmDeal.updateMany({ where: { customerAccountId, contactId: fromContactId }, data: { contactId: toContactId } })
  await tx.crmContactSource.updateMany({ where: { customerAccountId, contactId: fromContactId }, data: { contactId: toContactId } })
  await tx.contactConsent.updateMany({ where: { customerAccountId, contactId: fromContactId }, data: { contactId: toContactId } })
  await tx.contactSuppression.updateMany({ where: { customerAccountId, contactId: fromContactId }, data: { contactId: toContactId } })

  const duplicateIdentities = await tx.crmContactChannelIdentity.findMany({
    where: { customerAccountId, contactId: fromContactId },
  })
  for (const identity of duplicateIdentities) {
    const conflict = await tx.crmContactChannelIdentity.findFirst({
      where: {
        customerAccountId,
        identityType: identity.identityType,
        normalizedValue: identity.normalizedValue,
        NOT: { id: identity.id },
      },
    })
    if (conflict) {
      await tx.crmContactChannelIdentity.delete({ where: { id: identity.id } })
    } else {
      await tx.crmContactChannelIdentity.update({ where: { id: identity.id }, data: { contactId: toContactId } })
    }
  }

  const duplicateTags = await tx.crmContactTag.findMany({ where: { customerAccountId, contactId: fromContactId } })
  for (const tag of duplicateTags) {
    const conflict = await tx.crmContactTag.findFirst({
      where: { customerAccountId, contactId: toContactId, tagId: tag.tagId },
    })
    if (conflict) {
      await tx.crmContactTag.delete({ where: { id: tag.id } })
    } else {
      await tx.crmContactTag.update({ where: { id: tag.id }, data: { contactId: toContactId } })
    }
  }

  const duplicateMembers = await tx.crmSegmentMember.findMany({ where: { customerAccountId, contactId: fromContactId } })
  for (const member of duplicateMembers) {
    const conflict = await tx.crmSegmentMember.findFirst({
      where: { customerAccountId, contactId: toContactId, segmentId: member.segmentId },
    })
    if (conflict) {
      await tx.crmSegmentMember.delete({ where: { id: member.id } })
    } else {
      await tx.crmSegmentMember.update({ where: { id: member.id }, data: { contactId: toContactId } })
    }
  }

  const duplicateCompanies = await tx.crmContactCompanyRelationship.findMany({
    where: { customerAccountId, contactId: fromContactId },
  })
  for (const link of duplicateCompanies) {
    const conflict = await tx.crmContactCompanyRelationship.findFirst({
      where: { customerAccountId, contactId: toContactId, companyId: link.companyId },
    })
    if (conflict) {
      await tx.crmContactCompanyRelationship.delete({ where: { id: link.id } })
    } else {
      await tx.crmContactCompanyRelationship.update({ where: { id: link.id }, data: { contactId: toContactId } })
    }
  }
}

export async function approveMergeProposal(input: {
  customerAccountId: string
  proposalId: string
  actorUserId: string
}): Promise<CrmResult<{ survivorContactId: string; mergedContactId: string }>> {
  const proposal = await prisma.crmMergeProposal.findFirst({
    where: { id: input.proposalId, customerAccountId: input.customerAccountId },
  })
  if (!proposal) return { ok: false, code: 'NOT_FOUND', message: 'Merge proposal not found' }
  if (proposal.status !== 'PENDING') {
    return { ok: false, code: 'CONFLICT', message: 'Merge proposal is not pending' }
  }

  const cross = await rejectCrossAccountMerge(input.customerAccountId, input.customerAccountId)
  if (!cross.ok) return cross

  const [primary, duplicate] = await Promise.all([
    prisma.crmContact.findFirst({
      where: { id: proposal.primaryContactId, customerAccountId: input.customerAccountId, status: 'ACTIVE' },
    }),
    prisma.crmContact.findFirst({
      where: { id: proposal.duplicateContactId, customerAccountId: input.customerAccountId, status: 'ACTIVE' },
    }),
  ])
  if (!primary || !duplicate) return { ok: false, code: 'NOT_FOUND', message: 'Merge contacts not found' }
  if (primary.customerAccountId !== duplicate.customerAccountId) {
    return { ok: false, code: 'CROSS_ACCOUNT_DENIED', message: 'Cross-account merge denied' }
  }

  await prisma.$transaction(async (tx) => {
    await reassignContactChildren(tx, input.customerAccountId, duplicate.id, primary.id)
    await tx.crmContact.update({
      where: { id: duplicate.id },
      data: { status: 'MERGED', mergedIntoContactId: primary.id },
    })
    await tx.crmContactMergeAudit.create({
      data: {
        customerAccountId: input.customerAccountId,
        survivorContactId: primary.id,
        mergedContactId: duplicate.id,
        actorUserId: input.actorUserId,
        detail: { proposalId: proposal.id, confidenceBps: proposal.confidenceBps },
      },
    })
    await tx.crmMergeProposal.update({
      where: { id: proposal.id },
      data: { status: 'APPROVED' },
    })
  })

  return { ok: true, value: { survivorContactId: primary.id, mergedContactId: duplicate.id } }
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
