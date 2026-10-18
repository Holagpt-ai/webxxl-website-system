import { MKT_MAX_REVISIONS_PER_ARTIFACT, isMktDraftPreparationEnabled } from '@/config/mkt-backend'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { computeMarketingArtifactRevisionHash } from '@/lib/platform/marketing/artifact-hash'
import { assertMarketingContentAllowed } from '@/lib/platform/marketing/content-safety'
import { generateDeterministicAdCreative, generateDeterministicLandingPage } from '@/lib/platform/marketing/creative-generator'
import { transitionMarketingRequest } from '@/lib/platform/marketing/request-service'
import type { MktResult } from '@/lib/platform/marketing/types'

const POLICY_VERSION = 'mkt-08-v1'

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

  for (const step of [
    { toStatus: 'VALIDATING' as const, reason: 'Request validation started' },
    { toStatus: 'PREPARING' as const, reason: 'Draft preparation started' },
  ]) {
    await transitionMarketingRequest({
      customerAccountId: input.customerAccountId,
      requestId: request.id,
      toStatus: step.toStatus,
      actorUserId: input.userId,
      actorType: 'SERVICE',
      reason: step.reason,
    }).catch(() => null)
  }

  const brand = await prisma.marketingBrandContextVersion.findFirst({
    where: { customerAccountId: input.customerAccountId, managedSiteId: request.managedSiteId ?? undefined },
    orderBy: { versionNumber: 'desc' },
  })

  const businessName = brand?.businessName ?? 'Authorized business'
  const services = (brand?.approvedServices as string[] | null) ?? ['Professional services']
  const evidenceRefs = (request.sourceRefs as string[]) ?? []

  let structured: Record<string, unknown>
  let artifactType = request.requestType
  if (request.requestType === 'LANDING_PAGE' || request.requestType === 'SEO_FIX') {
    const draft = generateDeterministicLandingPage({
      goal: request.goal ?? request.brief,
      audience: request.audience ?? undefined,
      locale: request.locale === 'es' ? 'es' : 'en',
      businessName,
      approvedServices: services,
      evidenceRefs,
    })
    if (!draft.ok) return draft
    structured = draft.value.content as unknown as Record<string, unknown>
    artifactType = 'LANDING_PAGE'
  } else if (request.requestType === 'AD_CREATIVE') {
    const draft = generateDeterministicAdCreative({
      objective: request.goal ?? 'Awareness',
      locale: request.locale === 'es' ? 'es' : 'en',
      businessName,
    })
    if (!draft.ok) return draft
    structured = draft.value.content
  } else {
    structured = { summary: request.brief, goal: request.goal, note: 'Deterministic placeholder for request type' }
  }

  const safe = assertMarketingContentAllowed({ text: JSON.stringify(structured) })
  if (!safe.ok) return safe

  const revisionHash = computeMarketingArtifactRevisionHash({
    customerAccountId: input.customerAccountId,
    managedSiteId: request.managedSiteId,
    marketingRequestId: request.id,
    artifactType,
    locale: request.locale,
    structuredContent: structured,
    brandContextVersionId: brand?.id,
    complianceVersion: POLICY_VERSION,
    generationPolicyVersion: POLICY_VERSION,
    targetAudience: request.audience,
  })

  const artifact =
    (await prisma.marketingArtifact.findFirst({
      where: { customerAccountId: input.customerAccountId, marketingRequestId: request.id },
    })) ??
    (await prisma.marketingArtifact.create({
      data: {
        customerAccountId: input.customerAccountId,
        managedSiteId: request.managedSiteId,
        marketingRequestId: request.id,
        artifactType,
        revisionHash,
        payload: structured as Prisma.InputJsonValue,
        provenance: 'deterministic_generator:mkt-08',
        generationMode: 'DETERMINISTIC_DRAFT',
        locale: request.locale,
        brandContextVersionId: brand?.id,
        safetyClass: safe.value.safetyClass,
      },
    }))

  const revisionCount = await prisma.marketingArtifactRevision.count({
    where: { marketingArtifactId: artifact.id },
  })
  if (revisionCount >= MKT_MAX_REVISIONS_PER_ARTIFACT) {
    return { ok: false, code: 'VALIDATION', message: 'Revision limit reached' }
  }
  const revisionNumber = revisionCount + 1
  const previous = await prisma.marketingArtifactRevision.findFirst({
    where: { marketingArtifactId: artifact.id },
    orderBy: { revisionNumber: 'desc' },
  })

  await prisma.marketingArtifactRevision.create({
    data: {
      customerAccountId: input.customerAccountId,
      managedSiteId: request.managedSiteId,
      marketingRequestId: request.id,
      marketingArtifactId: artifact.id,
      revisionNumber,
      revisionHash,
      artifactType,
      locale: request.locale,
      structuredContent: structured as Prisma.InputJsonValue,
      brandContextVersionId: brand?.id,
      generationMode: 'DETERMINISTIC_DRAFT',
      generatorIdentity: 'mkt-08-deterministic',
      safetyClass: safe.value.safetyClass,
      previousRevisionId: previous?.id,
      createdByUserId: input.userId,
    },
  })

  await prisma.marketingArtifact.update({
    where: { id: artifact.id },
    data: { revisionHash, payload: structured as Prisma.InputJsonValue, reviewStatus: 'DRAFT' },
  })

  await transitionMarketingRequest({
    customerAccountId: input.customerAccountId,
    requestId: request.id,
    toStatus: 'DRAFT_READY',
    actorUserId: input.userId,
    actorType: 'SERVICE',
    reason: 'Draft artifact prepared',
  })

  return { ok: true, value: { artifactId: artifact.id, revisionNumber, revisionHash } }
}

export async function createMarketingArtifactRevision(input: {
  customerAccountId: string
  userId: string
  artifactId: string
  structuredContent: Record<string, unknown>
}): Promise<MktResult<{ revisionNumber: number; revisionHash: string }>> {
  const artifact = await prisma.marketingArtifact.findFirst({
    where: { id: input.artifactId, customerAccountId: input.customerAccountId },
  })
  if (!artifact) return { ok: false, code: 'NOT_FOUND', message: 'Artifact not found' }
  const safe = assertMarketingContentAllowed({ text: JSON.stringify(input.structuredContent) })
  if (!safe.ok) return safe

  const revisionCount = await prisma.marketingArtifactRevision.count({ where: { marketingArtifactId: artifact.id } })
  const revisionNumber = revisionCount + 1
  const previous = await prisma.marketingArtifactRevision.findFirst({
    where: { marketingArtifactId: artifact.id },
    orderBy: { revisionNumber: 'desc' },
  })
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

  await prisma.marketingArtifactRevision.create({
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
  await prisma.marketingArtifact.update({
    where: { id: artifact.id },
    data: { revisionHash, payload: input.structuredContent as Prisma.InputJsonValue, reviewStatus: 'DRAFT' },
  })
  return { ok: true, value: { revisionNumber, revisionHash } }
}
