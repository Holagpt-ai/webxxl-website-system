import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { CrmResult } from '@/lib/platform/crm/types'

type DbTx = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

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
  const rejected = await prisma.$transaction(async (tx) => {
    const claim = await tx.crmMergeProposal.updateMany({
      where: { id: input.proposalId, customerAccountId: input.customerAccountId, status: 'PENDING' },
      data: { status: 'REJECTED' },
    })
    return claim.count
  })
  if (rejected === 0) {
    const proposal = await prisma.crmMergeProposal.findFirst({
      where: { id: input.proposalId, customerAccountId: input.customerAccountId },
    })
    if (!proposal) return { ok: false, code: 'NOT_FOUND', message: 'Merge proposal not found' }
    return { ok: false, code: 'CONFLICT', message: 'Merge proposal is not pending' }
  }
  return { ok: true, value: true }
}

export async function applyConsentMergePreservation(
  customerAccountId: string,
  fromContactId: string,
  toContactId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await mergeConsentsPreservingProvenance(tx, customerAccountId, fromContactId, toContactId)
  })
}

async function mergeConsentsPreservingProvenance(
  tx: DbTx,
  customerAccountId: string,
  fromContactId: string,
  toContactId: string,
) {
  const duplicateConsents = await tx.contactConsent.findMany({
    where: { customerAccountId, contactId: fromContactId },
  })
  for (const consent of duplicateConsents) {
    const primaryMatch = await tx.contactConsent.findFirst({
      where: {
        customerAccountId,
        contactId: toContactId,
        channel: consent.channel,
        purpose: consent.purpose,
      },
      orderBy: { capturedAt: 'desc' },
    })
    if (!primaryMatch) {
      await tx.contactConsent.update({ where: { id: consent.id }, data: { contactId: toContactId } })
      continue
    }
    if (primaryMatch.status === consent.status) {
      await tx.contactConsent.delete({ where: { id: consent.id } })
      continue
    }
    if (primaryMatch.status !== 'GRANTED' && consent.status === 'GRANTED') {
      await tx.contactConsent.delete({ where: { id: consent.id } })
      continue
    }
    await tx.contactConsent.delete({ where: { id: consent.id } })
  }

  const duplicateSuppressions = await tx.contactSuppression.findMany({
    where: { customerAccountId, contactId: fromContactId },
  })
  for (const suppression of duplicateSuppressions) {
    if (suppression.active) {
      const primaryActive = await tx.contactSuppression.findFirst({
        where: {
          customerAccountId,
          contactId: toContactId,
          channel: suppression.channel,
          purpose: suppression.purpose,
          active: true,
        },
      })
      if (primaryActive) {
        await tx.contactSuppression.delete({ where: { id: suppression.id } })
        continue
      }
    }
    await tx.contactSuppression.update({ where: { id: suppression.id }, data: { contactId: toContactId } })
  }
}

async function reassignChatwootMappings(tx: DbTx, customerAccountId: string, fromContactId: string, toContactId: string) {
  const survivorMapping = await tx.chatwootContactMapping.findFirst({
    where: { customerAccountId, crmContactId: toContactId },
  })
  const duplicateMappings = await tx.chatwootContactMapping.findMany({
    where: { customerAccountId, crmContactId: fromContactId },
  })
  for (const mapping of duplicateMappings) {
    if (survivorMapping) {
      await tx.chatwootContactMapping.delete({ where: { id: mapping.id } })
    } else {
      await tx.chatwootContactMapping.update({ where: { id: mapping.id }, data: { crmContactId: toContactId } })
    }
  }
  await tx.chatwootConversationMapping.updateMany({
    where: { customerAccountId, crmContactId: fromContactId },
    data: { crmContactId: toContactId },
  })
}

async function reassignFollowUpRecords(tx: DbTx, customerAccountId: string, fromContactId: string, toContactId: string) {
  await tx.marketingLeadFollowUpEvaluation.updateMany({
    where: { customerAccountId, crmContactId: fromContactId },
    data: { crmContactId: toContactId },
  })
  const duplicateIntents = await tx.marketingFollowUpTaskIntent.findMany({
    where: { customerAccountId, crmContactId: fromContactId },
  })
  for (const intent of duplicateIntents) {
    const conflict = await tx.marketingFollowUpTaskIntent.findFirst({
      where: {
        customerAccountId,
        crmContactId: toContactId,
        policyKey: intent.policyKey,
        evaluationId: intent.evaluationId,
      },
    })
    if (conflict) {
      await tx.marketingFollowUpTaskIntent.delete({ where: { id: intent.id } })
    } else {
      await tx.marketingFollowUpTaskIntent.update({ where: { id: intent.id }, data: { crmContactId: toContactId } })
    }
  }
}

async function reassignContactChildren(
  tx: DbTx,
  customerAccountId: string,
  fromContactId: string,
  toContactId: string,
) {
  await tx.crmTimelineEvent.updateMany({ where: { customerAccountId, contactId: fromContactId }, data: { contactId: toContactId } })
  await tx.crmContactNote.updateMany({ where: { customerAccountId, contactId: fromContactId }, data: { contactId: toContactId } })
  await tx.crmTask.updateMany({ where: { customerAccountId, contactId: fromContactId }, data: { contactId: toContactId } })
  await tx.crmDeal.updateMany({ where: { customerAccountId, contactId: fromContactId }, data: { contactId: toContactId } })
  await tx.crmContactSource.updateMany({ where: { customerAccountId, contactId: fromContactId }, data: { contactId: toContactId } })
  await mergeConsentsPreservingProvenance(tx, customerAccountId, fromContactId, toContactId)
  await reassignChatwootMappings(tx, customerAccountId, fromContactId, toContactId)
  await reassignFollowUpRecords(tx, customerAccountId, fromContactId, toContactId)

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
  try {
    const result = await prisma.$transaction(async (tx) => {
      const claim = await tx.crmMergeProposal.updateMany({
        where: { id: input.proposalId, customerAccountId: input.customerAccountId, status: 'PENDING' },
        data: { status: 'RESOLVING' },
      })
      if (claim.count === 0) throw new Error('MERGE_NOT_PENDING')

      const proposal = await tx.crmMergeProposal.findFirst({
        where: { id: input.proposalId, customerAccountId: input.customerAccountId },
      })
      if (!proposal) throw new Error('MERGE_NOT_FOUND')

      const [primary, duplicate] = await Promise.all([
        tx.crmContact.findFirst({
          where: { id: proposal.primaryContactId, customerAccountId: input.customerAccountId, status: 'ACTIVE' },
        }),
        tx.crmContact.findFirst({
          where: { id: proposal.duplicateContactId, customerAccountId: input.customerAccountId, status: 'ACTIVE' },
        }),
      ])
      if (!primary || !duplicate) throw new Error('MERGE_CONTACTS_INVALID')
      if (primary.customerAccountId !== duplicate.customerAccountId) throw new Error('MERGE_CROSS_ACCOUNT')

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
          detail: { proposalId: proposal.id, confidenceBps: proposal.confidenceBps } as Prisma.JsonObject,
        },
      })
      await tx.crmMergeProposal.update({
        where: { id: proposal.id },
        data: { status: 'APPROVED' },
      })
      return { survivorContactId: primary.id, mergedContactId: duplicate.id }
    })
    return { ok: true, value: result }
  } catch (error) {
    if (error instanceof Error && error.message === 'MERGE_NOT_FOUND') {
      return { ok: false, code: 'NOT_FOUND', message: 'Merge proposal not found' }
    }
    if (error instanceof Error && error.message === 'MERGE_NOT_PENDING') {
      return { ok: false, code: 'CONFLICT', message: 'Merge proposal is not pending' }
    }
    if (error instanceof Error && error.message === 'MERGE_CONTACTS_INVALID') {
      return { ok: false, code: 'NOT_FOUND', message: 'Merge contacts not found' }
    }
    if (error instanceof Error && error.message === 'MERGE_CROSS_ACCOUNT') {
      return { ok: false, code: 'CROSS_ACCOUNT_DENIED', message: 'Cross-account merge denied' }
    }
    throw error
  }
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
