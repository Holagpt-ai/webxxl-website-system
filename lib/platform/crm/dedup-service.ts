import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  evaluateMergeChatwootCompatibility,
  evaluateMergeConsentCompatibility,
} from '@/lib/platform/crm/merge-preflight'
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

async function loadMergePreflightData(tx: DbTx, customerAccountId: string, survivorContactId: string, duplicateContactId: string) {
  const [survivorConsents, duplicateConsents, survivorSuppressions, duplicateSuppressions, survivorMapping, duplicateMapping] =
    await Promise.all([
      tx.contactConsent.findMany({ where: { customerAccountId, contactId: survivorContactId }, include: { evidence: true } }),
      tx.contactConsent.findMany({ where: { customerAccountId, contactId: duplicateContactId }, include: { evidence: true } }),
      tx.contactSuppression.findMany({ where: { customerAccountId, contactId: survivorContactId } }),
      tx.contactSuppression.findMany({ where: { customerAccountId, contactId: duplicateContactId } }),
      tx.chatwootContactMapping.findFirst({ where: { customerAccountId, crmContactId: survivorContactId } }),
      tx.chatwootContactMapping.findFirst({ where: { customerAccountId, crmContactId: duplicateContactId } }),
    ])
  return {
    survivorConsents,
    duplicateConsents,
    survivorSuppressions,
    duplicateSuppressions,
    survivorMapping,
    duplicateMapping,
  }
}

function assertMergePreflight(input: Awaited<ReturnType<typeof loadMergePreflightData>>) {
  const consentConflict = evaluateMergeConsentCompatibility({
    survivorConsents: input.survivorConsents.map((row) => ({
      channel: row.channel,
      purpose: row.purpose,
      status: row.status,
      capturedAt: row.capturedAt,
      source: row.source,
      termsVersion: row.termsVersion,
    })),
    duplicateConsents: input.duplicateConsents.map((row) => ({
      channel: row.channel,
      purpose: row.purpose,
      status: row.status,
      capturedAt: row.capturedAt,
      source: row.source,
      termsVersion: row.termsVersion,
    })),
    survivorSuppressions: input.survivorSuppressions.map((row) => ({
      channel: row.channel,
      purpose: row.purpose,
      active: row.active,
      source: row.source,
      reason: row.reason,
    })),
    duplicateSuppressions: input.duplicateSuppressions.map((row) => ({
      channel: row.channel,
      purpose: row.purpose,
      active: row.active,
      source: row.source,
      reason: row.reason,
    })),
  })
  if (consentConflict) throw new Error(`MERGE_CONSENT_CONFLICT:${consentConflict.message}`)

  const chatwootConflict = evaluateMergeChatwootCompatibility({
    survivorMapping: input.survivorMapping
      ? { chatwootContactId: input.survivorMapping.chatwootContactId, chatwootAccountId: input.survivorMapping.chatwootAccountId }
      : null,
    duplicateMapping: input.duplicateMapping
      ? { chatwootContactId: input.duplicateMapping.chatwootContactId, chatwootAccountId: input.duplicateMapping.chatwootAccountId }
      : null,
  })
  if (chatwootConflict) throw new Error(`MERGE_CHATWOOT_CONFLICT:${chatwootConflict.message}`)
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
    await tx.contactConsent.update({ where: { id: consent.id }, data: { contactId: toContactId } })
  }

  const duplicateSuppressions = await tx.contactSuppression.findMany({
    where: { customerAccountId, contactId: fromContactId },
  })
  for (const suppression of duplicateSuppressions) {
    await tx.contactSuppression.update({ where: { id: suppression.id }, data: { contactId: toContactId } })
  }
}

async function reassignChatwootMappings(tx: DbTx, customerAccountId: string, fromContactId: string, toContactId: string) {
  const survivorMapping = await tx.chatwootContactMapping.findFirst({
    where: { customerAccountId, crmContactId: toContactId },
  })
  const duplicateMapping = await tx.chatwootContactMapping.findFirst({
    where: { customerAccountId, crmContactId: fromContactId },
  })
  if (!duplicateMapping) {
    await tx.chatwootConversationMapping.updateMany({
      where: { customerAccountId, crmContactId: fromContactId },
      data: { crmContactId: toContactId },
    })
    return
  }
  if (!survivorMapping) {
    await tx.chatwootContactMapping.update({
      where: { id: duplicateMapping.id },
      data: { crmContactId: toContactId },
    })
  } else if (survivorMapping.chatwootContactId === duplicateMapping.chatwootContactId) {
    await tx.chatwootContactMapping.delete({ where: { id: duplicateMapping.id } })
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

      const preflight = await loadMergePreflightData(tx, input.customerAccountId, primary.id, duplicate.id)
      assertMergePreflight(preflight)

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
    if (error instanceof Error && error.message.startsWith('MERGE_CONSENT_CONFLICT:')) {
      return { ok: false, code: 'CONFLICT', message: error.message.replace('MERGE_CONSENT_CONFLICT:', '') }
    }
    if (error instanceof Error && error.message.startsWith('MERGE_CHATWOOT_CONFLICT:')) {
      return { ok: false, code: 'CONFLICT', message: error.message.replace('MERGE_CHATWOOT_CONFLICT:', '') }
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

/** Test helper: runs consent/suppression reassignment inside a transaction after preflight. */
export async function applyConsentMergePreservation(
  customerAccountId: string,
  fromContactId: string,
  toContactId: string,
): Promise<CrmResult<true>> {
  try {
    await prisma.$transaction(async (tx) => {
      const preflight = await loadMergePreflightData(tx, customerAccountId, toContactId, fromContactId)
      assertMergePreflight(preflight)
      await mergeConsentsPreservingProvenance(tx, customerAccountId, fromContactId, toContactId)
    })
    return { ok: true, value: true }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('MERGE_CONSENT_CONFLICT:')) {
      return { ok: false, code: 'CONFLICT', message: error.message.replace('MERGE_CONSENT_CONFLICT:', '') }
    }
    throw error
  }
}
