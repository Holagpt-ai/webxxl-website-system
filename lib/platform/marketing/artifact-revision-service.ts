import { Prisma } from '@prisma/client'
import { MKT_MAX_REVISIONS_PER_ARTIFACT, isMktDraftPreparationEnabled } from '@/config/mkt-backend'
import { prisma } from '@/lib/db'
import type { MarketingRequestStatus } from '@prisma/client'
import {
  revokePendingArtifactReviewsInTransaction,
} from '@/lib/platform/marketing/approval-service'
import { computeMarketingArtifactRevisionHash } from '@/lib/platform/marketing/artifact-hash'
import { resolveBrandDraftTrust } from '@/lib/platform/marketing/brand-trust'
import { assertMarketingContentAllowed } from '@/lib/platform/marketing/content-safety'
import { generateDeterministicAdCreative, generateDeterministicLandingPage } from '@/lib/platform/marketing/creative-generator'
import {
  mapTransitionFailureToPrepareRollback,
  MarketingPrepareWorkflowRollbackError,
  transitionMarketingRequestInTransaction,
} from '@/lib/platform/marketing/request-service'
import type { MktResult } from '@/lib/platform/marketing/types'

const POLICY_VERSION = 'mkt-08-v1'

const PREPARE_ALLOWED_STATUSES: MarketingRequestStatus[] = [
  'SUBMITTED',
  'VALIDATING',
  'PREPARING',
  'DRAFT_READY',
  'REVISION_REQUESTED',
]

async function advanceRequestToPreparingInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    customerAccountId: string
    requestId: string
    userId: string
    currentStatus: MarketingRequestStatus
  },
): Promise<MarketingRequestStatus> {
  let status = input.currentStatus
  if (status === 'SUBMITTED') {
    const v = await transitionMarketingRequestInTransaction(tx, {
      customerAccountId: input.customerAccountId,
      requestId: input.requestId,
      toStatus: 'VALIDATING',
      actorUserId: input.userId,
      actorType: 'SERVICE',
      reason: 'Request validation started',
    })
    if (!v.ok) throw mapTransitionFailureToPrepareRollback(v)
    status = 'VALIDATING'
  }
  if (status === 'VALIDATING' || status === 'REVISION_REQUESTED') {
    const p = await transitionMarketingRequestInTransaction(tx, {
      customerAccountId: input.customerAccountId,
      requestId: input.requestId,
      toStatus: 'PREPARING',
      actorUserId: input.userId,
      actorType: 'SERVICE',
      reason: 'Draft preparation started',
    })
    if (!p.ok) throw mapTransitionFailureToPrepareRollback(p)
    status = 'PREPARING'
  }
  return status
}

export async function prepareMarketingArtifactForRequest(input: {
  customerAccountId: string
  userId: string
  requestId: string
}): Promise<MktResult<{ artifactId: string; revisionNumber: number; revisionHash: string }>> {
  if (!isMktDraftPreparationEnabled()) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'Marketing draft preparation disabled' }
  }

  const request = await prisma.marketingRequest.findFirst({
    where: { id: input.requestId, customerAccountId: input.customerAccountId },
  })
  if (!request) return { ok: false, code: 'NOT_FOUND', message: 'Marketing request not found' }
  if (!PREPARE_ALLOWED_STATUSES.includes(request.status)) {
    return { ok: false, code: 'VALIDATION', message: `Cannot prepare draft from status ${request.status}` }
  }

  const brandRow = await prisma.marketingBrandContextVersion.findFirst({
    where: {
      customerAccountId: input.customerAccountId,
      managedSiteId: request.managedSiteId ?? undefined,
      locale: request.locale,
    },
    orderBy: { versionNumber: 'desc' },
  })
  const brandTrust = resolveBrandDraftTrust(brandRow)
  if (!brandTrust.ok) return brandTrust
  const brand = brandTrust.value

  const evidenceRefs = (request.sourceRefs as string[]) ?? []
  let structured: Record<string, unknown>
  let artifactType = request.requestType

  if (request.requestType === 'LANDING_PAGE' || request.requestType === 'SEO_FIX') {
    const draft = generateDeterministicLandingPage({
      goal: request.goal ?? request.brief,
      audience: request.audience ?? undefined,
      locale: request.locale === 'es' ? 'es' : 'en',
      businessName: brand.businessName,
      approvedServices: brand.approvedServices,
      evidenceRefs,
    })
    if (!draft.ok) return draft
    structured = {
      ...(draft.value.content as unknown as Record<string, unknown>),
      brandTrustLevel: brand.trustLevel,
      humanReviewRequired: brand.requiresHumanReview,
    }
    artifactType = 'LANDING_PAGE'
  } else if (request.requestType === 'AD_CREATIVE') {
    const draft = generateDeterministicAdCreative({
      objective: request.goal ?? 'Awareness',
      locale: request.locale === 'es' ? 'es' : 'en',
      businessName: brand.businessName,
    })
    if (!draft.ok) return draft
    structured = { ...draft.value.content, brandTrustLevel: brand.trustLevel, humanReviewRequired: brand.requiresHumanReview }
  } else {
    structured = {
      summary: request.brief,
      goal: request.goal,
      brandTrustLevel: brand.trustLevel,
      humanReviewRequired: brand.requiresHumanReview,
      note: 'Deterministic placeholder for request type',
    }
  }

  const safe = assertMarketingContentAllowed({
    text: JSON.stringify(structured),
    allowRegulated: brand.trustLevel === 'COMPLIANCE_APPROVED',
  })
  if (!safe.ok) return safe
  const safetyClass = safe.value.safetyClass

  const revisionHash = computeMarketingArtifactRevisionHash({
    customerAccountId: input.customerAccountId,
    managedSiteId: request.managedSiteId,
    marketingRequestId: request.id,
    artifactType,
    locale: request.locale,
    structuredContent: structured,
    brandContextVersionId: brand.brandContextVersionId,
    complianceVersion: POLICY_VERSION,
    generationPolicyVersion: POLICY_VERSION,
    targetAudience: request.audience,
  })

  const idempotentRevision = await prisma.marketingArtifactRevision.findFirst({
    where: { customerAccountId: input.customerAccountId, revisionHash },
  })
  if (idempotentRevision) {
    return {
      ok: true,
      value: {
        artifactId: idempotentRevision.marketingArtifactId,
        revisionNumber: idempotentRevision.revisionNumber,
        revisionHash,
      },
    }
  }

  if (request.status === 'DRAFT_READY') {
    return {
      ok: false,
      code: 'VALIDATION',
      message: 'Request already draft-ready; create a new revision or move to REVISION_REQUESTED',
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const live = await tx.marketingRequest.findFirst({
        where: { id: input.requestId, customerAccountId: input.customerAccountId },
      })
      if (!live || !PREPARE_ALLOWED_STATUSES.includes(live.status)) {
        throw new MarketingPrepareWorkflowRollbackError('VALIDATION', 'Request not eligible for preparation')
      }

      await advanceRequestToPreparingInTransaction(tx, {
        customerAccountId: input.customerAccountId,
        requestId: live.id,
        userId: input.userId,
        currentStatus: live.status,
      })

      const artifact =
        (await tx.marketingArtifact.findFirst({
          where: { customerAccountId: input.customerAccountId, marketingRequestId: live.id },
        })) ??
        (await tx.marketingArtifact.create({
          data: {
            customerAccountId: input.customerAccountId,
            managedSiteId: live.managedSiteId,
            marketingRequestId: live.id,
            artifactType,
            revisionHash,
            payload: structured as Prisma.InputJsonValue,
            provenance: 'deterministic_generator:mkt-08',
            generationMode: 'DETERMINISTIC_DRAFT',
            locale: live.locale,
            brandContextVersionId: brand.brandContextVersionId,
            safetyClass,
          },
        }))

      const revisionCount = await tx.marketingArtifactRevision.count({
        where: { marketingArtifactId: artifact.id },
      })
      if (revisionCount >= MKT_MAX_REVISIONS_PER_ARTIFACT) {
        throw new MarketingPrepareWorkflowRollbackError('VALIDATION', 'Revision limit reached')
      }

      const previous = await tx.marketingArtifactRevision.findFirst({
        where: { marketingArtifactId: artifact.id },
        orderBy: { revisionNumber: 'desc' },
      })
      const revisionNumber = (previous?.revisionNumber ?? 0) + 1

      await tx.marketingArtifactRevision.create({
        data: {
          customerAccountId: input.customerAccountId,
          managedSiteId: live.managedSiteId,
          marketingRequestId: live.id,
          marketingArtifactId: artifact.id,
          revisionNumber,
          revisionHash,
          artifactType,
          locale: live.locale,
          structuredContent: structured as Prisma.InputJsonValue,
          brandContextVersionId: brand.brandContextVersionId,
          generationMode: 'DETERMINISTIC_DRAFT',
          generatorIdentity: 'mkt-08-deterministic',
          safetyClass,
          previousRevisionId: previous?.id,
          createdByUserId: input.userId,
        },
      })

      await tx.marketingArtifact.update({
        where: { id: artifact.id },
        data: { revisionHash, payload: structured as Prisma.InputJsonValue, reviewStatus: 'DRAFT' },
      })

      await revokePendingArtifactReviewsInTransaction(tx, {
        customerAccountId: input.customerAccountId,
        marketingArtifactId: artifact.id,
      })

      const ready = await transitionMarketingRequestInTransaction(tx, {
        customerAccountId: input.customerAccountId,
        requestId: live.id,
        toStatus: 'DRAFT_READY',
        actorUserId: input.userId,
        actorType: 'SERVICE',
        reason: 'Draft artifact prepared',
      })
      if (!ready.ok) throw mapTransitionFailureToPrepareRollback(ready)

      return { artifactId: artifact.id, revisionNumber, revisionHash }
    })

    return { ok: true, value: result }
  } catch (error) {
    if (error instanceof MarketingPrepareWorkflowRollbackError) {
      return { ok: false, code: error.code, message: error.message }
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await prisma.marketingArtifactRevision.findFirst({
        where: { customerAccountId: input.customerAccountId, revisionHash },
      })
      if (raced) {
        return {
          ok: true,
          value: {
            artifactId: raced.marketingArtifactId,
            revisionNumber: raced.revisionNumber,
            revisionHash,
          },
        }
      }
      return { ok: false, code: 'CONFLICT', message: 'Concurrent revision creation conflict' }
    }
    throw error
  }
}

export async function createMarketingArtifactRevision(input: {
  customerAccountId: string
  userId: string
  artifactId: string
  structuredContent: Record<string, unknown>
}): Promise<MktResult<{ revisionNumber: number; revisionHash: string }>> {
  if (!isMktDraftPreparationEnabled()) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'Marketing draft preparation disabled' }
  }

  const artifact = await prisma.marketingArtifact.findFirst({
    where: { id: input.artifactId, customerAccountId: input.customerAccountId },
  })
  if (!artifact) return { ok: false, code: 'NOT_FOUND', message: 'Artifact not found' }
  const safe = assertMarketingContentAllowed({ text: JSON.stringify(input.structuredContent) })
  if (!safe.ok) return safe

  const revisionHash = computeMarketingArtifactRevisionHash({
    customerAccountId: input.customerAccountId,
    managedSiteId: artifact.managedSiteId,
    marketingRequestId: artifact.marketingRequestId,
    artifactType: artifact.artifactType,
    locale: artifact.locale,
    structuredContent: input.structuredContent,
    brandContextVersionId: artifact.brandContextVersionId,
    complianceVersion: POLICY_VERSION,
    generationPolicyVersion: POLICY_VERSION,
  })

  const existing = await prisma.marketingArtifactRevision.findFirst({
    where: { customerAccountId: input.customerAccountId, revisionHash },
  })
  if (existing) {
    return { ok: true, value: { revisionNumber: existing.revisionNumber, revisionHash } }
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const revisionCount = await tx.marketingArtifactRevision.count({ where: { marketingArtifactId: artifact.id } })
      if (revisionCount >= MKT_MAX_REVISIONS_PER_ARTIFACT) {
        throw new MarketingPrepareWorkflowRollbackError('VALIDATION', 'Revision limit reached')
      }
      const previous = await tx.marketingArtifactRevision.findFirst({
        where: { marketingArtifactId: artifact.id },
        orderBy: { revisionNumber: 'desc' },
      })
      const revisionNumber = (previous?.revisionNumber ?? 0) + 1

      await tx.marketingArtifactRevision.create({
        data: {
          customerAccountId: input.customerAccountId,
          managedSiteId: artifact.managedSiteId,
          marketingRequestId: artifact.marketingRequestId,
          marketingArtifactId: artifact.id,
          revisionNumber,
          revisionHash,
          artifactType: artifact.artifactType,
          locale: artifact.locale,
          structuredContent: input.structuredContent as Prisma.InputJsonValue,
          brandContextVersionId: artifact.brandContextVersionId,
          generationMode: 'DETERMINISTIC_DRAFT',
          generatorIdentity: 'mkt-08-deterministic',
          safetyClass: safe.value.safetyClass,
          previousRevisionId: previous?.id,
          createdByUserId: input.userId,
        },
      })
      await tx.marketingArtifact.update({
        where: { id: artifact.id },
        data: {
          revisionHash,
          payload: input.structuredContent as Prisma.InputJsonValue,
          reviewStatus: 'DRAFT',
        },
      })
      await revokePendingArtifactReviewsInTransaction(tx, {
        customerAccountId: input.customerAccountId,
        marketingArtifactId: artifact.id,
      })
      return { revisionNumber, revisionHash }
    })

    return { ok: true, value: created }
  } catch (error) {
    if (error instanceof MarketingPrepareWorkflowRollbackError) {
      return { ok: false, code: error.code, message: error.message }
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await prisma.marketingArtifactRevision.findFirst({
        where: { customerAccountId: input.customerAccountId, revisionHash },
      })
      if (raced) return { ok: true, value: { revisionNumber: raced.revisionNumber, revisionHash } }
      return { ok: false, code: 'CONFLICT', message: 'Concurrent revision creation conflict' }
    }
    throw error
  }
}
