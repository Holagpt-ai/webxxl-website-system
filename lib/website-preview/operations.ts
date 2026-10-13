import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { automationHooks } from '@/lib/automation/hooks'
import { formatActivitySummary, writeProjectActivity } from '@/lib/portal/activity'
import { previewApprovalMetadata, previewDecisionIsBound } from '@/lib/website-preview/binding'
import { guardKnownDeploymentProject } from '@/lib/website-preview/catalog'
import { previewChangeRequestDescription, previewChangeRequestTitle } from '@/lib/website-preview/display'
import { parseWebsitePreviewInput, type ParsedWebsitePreview } from '@/lib/website-preview/validation'

export type PreviewWriteResult = { ok: true } | { ok: false; error: string }

type ProjectRef = { id: string; customerAccountId: string }

function approvalData(projectId: string, parsed: ParsedWebsitePreview) {
  return {
    projectId,
    title: parsed.versionLabel,
    description: parsed.deploymentId,
    status: 'PENDING' as const,
    metadata: previewApprovalMetadata({
      provider: parsed.provider,
      deploymentId: parsed.deploymentId,
      versionLabel: parsed.versionLabel,
      sourceRevision: parsed.sourceRevision,
    }),
  }
}

async function recordRegistration(
  actorUserId: string,
  project: ProjectRef,
  parsed: ParsedWebsitePreview,
  approvalId: string | null,
) {
  await writeProjectActivity({
    projectId: project.id,
    actorUserId,
    eventType: 'WEBSITE_PREVIEW_REGISTERED',
    summary: formatActivitySummary('WEBSITE_PREVIEW_REGISTERED', `${parsed.versionLabel} ${parsed.deploymentId}`),
    metadata: {
      provider: parsed.provider,
      deploymentId: parsed.deploymentId,
      versionLabel: parsed.versionLabel,
      sourceRevision: parsed.sourceRevision,
      registeredUrl: parsed.aliasUrl,
    },
  })
  if (!approvalId) return
  await writeProjectActivity({
    projectId: project.id,
    actorUserId,
    eventType: 'APPROVAL_REQUESTED',
    summary: formatActivitySummary('APPROVAL_REQUESTED', parsed.versionLabel),
    metadata: {
      provider: parsed.provider,
      deploymentId: parsed.deploymentId,
      versionLabel: parsed.versionLabel,
    },
  })
  await automationHooks.approvalRequested({
    approvalId,
    customerAccountId: project.customerAccountId,
    actorUserId,
    title: parsed.versionLabel,
  })
}

export async function registerWebsitePreview(input: {
  actorUserId: string
  project: ProjectRef
  provider: string
  displayName: string
  aliasUrl: string
  deploymentId: string
  versionLabel: string
  sourceRevision?: string | null
  status: string
}): Promise<PreviewWriteResult> {
  const parsed = parseWebsitePreviewInput(input)
  if (!parsed.ok) return parsed
  const guard = guardKnownDeploymentProject(input.project.id, parsed.value.deploymentId)
  if (!guard.ok) return guard

  const existing = await prisma.websitePreviewVersion.findUnique({
    where: {
      provider_deploymentId: { provider: parsed.value.provider, deploymentId: parsed.value.deploymentId },
    },
    include: { preview: true, approval: true },
  })

  if (existing) {
    if (existing.preview.projectId !== input.project.id) return { ok: false, error: 'deployment_already_registered' }
    if (!existing.isCurrent) return { ok: false, error: 'deployment_not_current' }
    if (existing.status === 'APPROVED' || existing.status === 'CHANGES_REQUESTED' || existing.status === 'SUPERSEDED') {
      return { ok: false, error: 'already_decided' }
    }

    let approvalId = existing.approvalId
    if (parsed.value.status === 'READY_FOR_REVIEW' && !approvalId) {
      const approval = await prisma.projectApproval.create({
        data: approvalData(input.project.id, parsed.value),
      })
      approvalId = approval.id
    }

    await prisma.websitePreviewVersion.update({
      where: { id: existing.id },
      data: {
        versionLabel: parsed.value.versionLabel,
        sourceRevision: parsed.value.sourceRevision,
        registeredUrl: parsed.value.aliasUrl,
        status: parsed.value.status,
        approvalId,
      },
    })
    await prisma.websitePreview.update({
      where: { id: existing.previewId },
      data: {
        provider: parsed.value.provider,
        displayName: parsed.value.displayName,
        aliasUrl: parsed.value.aliasUrl,
        status: parsed.value.status,
      },
    })
    await recordRegistration(input.actorUserId, input.project, parsed.value, approvalId && approvalId !== existing.approvalId ? approvalId : null)
    return { ok: true }
  }

  let created: { approvalId: string | null }
  try {
    created = await prisma.$transaction(async (tx) => {
    const preview = await tx.websitePreview.upsert({
      where: { projectId: input.project.id },
      create: {
        projectId: input.project.id,
        customerAccountId: input.project.customerAccountId,
        provider: parsed.value.provider,
        displayName: parsed.value.displayName,
        aliasUrl: parsed.value.aliasUrl,
        status: parsed.value.status,
      },
      update: {
        customerAccountId: input.project.customerAccountId,
        provider: parsed.value.provider,
        displayName: parsed.value.displayName,
        aliasUrl: parsed.value.aliasUrl,
        status: parsed.value.status,
      },
    })

    const previous = await tx.websitePreviewVersion.findMany({
      where: { previewId: preview.id, isCurrent: true },
      include: { approval: true },
    })
    for (const version of previous) {
      if (version.approval?.status === 'PENDING') {
        await tx.projectApproval.update({
          where: { id: version.approval.id },
          data: {
            status: 'CHANGES_REQUESTED',
            respondedAt: new Date(),
            responseNotes: `Superseded by deployment ${parsed.value.deploymentId}`,
          },
        })
      }
      const keepDecision = version.status === 'APPROVED' || version.status === 'CHANGES_REQUESTED'
      await tx.websitePreviewVersion.update({
        where: { id: version.id },
        data: { isCurrent: false, status: keepDecision ? version.status : 'SUPERSEDED' },
      })
    }

    let approvalId: string | null = null
    if (parsed.value.status === 'READY_FOR_REVIEW') {
      const approval = await tx.projectApproval.create({
        data: approvalData(input.project.id, parsed.value),
      })
      approvalId = approval.id
    }

    await tx.websitePreviewVersion.create({
      data: {
        previewId: preview.id,
        provider: parsed.value.provider,
        deploymentId: parsed.value.deploymentId,
        versionLabel: parsed.value.versionLabel,
        sourceRevision: parsed.value.sourceRevision,
        registeredUrl: parsed.value.aliasUrl,
        status: parsed.value.status,
        isCurrent: true,
        registeredById: input.actorUserId,
        approvalId,
      },
    })
    return { approvalId }
    })
  } catch {
    return { ok: false, error: 'failed' }
  }

  await recordRegistration(input.actorUserId, input.project, parsed.value, created.approvalId)
  return { ok: true }
}

export async function findCustomerWebsitePreview(customerAccountId: string, projectId: string) {
  return prisma.websitePreview.findFirst({
    where: { projectId, customerAccountId },
    include: {
      versions: {
        where: { isCurrent: true },
        include: { approval: true },
        take: 1,
      },
    },
  })
}

export async function findStaffWebsitePreview(projectId: string) {
  return prisma.websitePreview.findUnique({
    where: { projectId },
    include: {
      versions: {
        orderBy: { registeredAt: 'desc' },
        include: { approval: true },
      },
    },
  })
}

export async function syncWebsitePreviewDecision(input: {
  approvalId: string
  decision: 'APPROVED' | 'CHANGES_REQUESTED'
  actorUserId: string
  notes?: string
  locale?: string
}): Promise<void> {
  const version = await prisma.websitePreviewVersion.findUnique({
    where: { approvalId: input.approvalId },
    include: { preview: true },
  })
  if (!version?.isCurrent) return

  const nextStatus = input.decision === 'APPROVED' ? 'APPROVED' : 'CHANGES_REQUESTED'
  await prisma.websitePreviewVersion.update({
    where: { id: version.id },
    data: { status: nextStatus },
  })
  await prisma.websitePreview.update({
    where: { id: version.previewId },
    data: { status: nextStatus },
  })

  if (input.decision !== 'CHANGES_REQUESTED' || version.changeRequestId) return

  const title = previewChangeRequestTitle(input.locale ?? 'en', version.versionLabel)
  const description = previewChangeRequestDescription(input.notes ?? '', version.deploymentId)
  const created = await prisma.changeRequest.create({
    data: {
      projectId: version.preview.projectId,
      submittedById: input.actorUserId,
      title,
      description,
      priority: 'NORMAL',
    },
  })
  await prisma.websitePreviewVersion.update({
    where: { id: version.id },
    data: { changeRequestId: created.id },
  })
  await writeProjectActivity({
    projectId: version.preview.projectId,
    actorUserId: input.actorUserId,
    eventType: 'CHANGE_REQUEST_SUBMITTED',
    summary: formatActivitySummary('CHANGE_REQUEST_SUBMITTED', title),
    metadata: {
      provider: version.provider,
      deploymentId: version.deploymentId,
      versionLabel: version.versionLabel,
    },
  })
  await automationHooks.changeRequestSubmitted({
    changeRequestId: created.id,
    customerAccountId: version.preview.customerAccountId,
    actorUserId: input.actorUserId,
    title,
  })
}

export async function linkedPreviewRejectsDecision(approvalId: string, metadata: Prisma.JsonValue | null): Promise<'ok' | 'superseded' | 'not_found'> {
  const version = await prisma.websitePreviewVersion.findUnique({ where: { approvalId } })
  if (!version) return 'ok'
  const bound = previewDecisionIsBound({
    version,
    approvalId,
    approvalMetadata: metadata,
  })
  if (bound) return 'ok'
  return version.isCurrent ? 'not_found' : 'superseded'
}
