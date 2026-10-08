'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireCustomerMembership, requireProjectAccess } from '@/lib/portal/authz'
import { writeProjectActivity, formatActivitySummary } from '@/lib/portal/activity'
import { notificationHooks } from '@/lib/portal/notifications'
import { buildStorageKey, getStorageProvider, validateUpload } from '@/lib/integrations/storage'
import type { ChangeRequestPriority, ProjectFileCategory } from '@prisma/client'

export type ActionResult = { ok: true } | { ok: false; error: string }

function revalidateDashboard() {
  revalidatePath('/dashboard', 'layout')
}

export async function resolveDependencyAction(dependencyId: string): Promise<ActionResult> {
  try {
    const portal = await requireCustomerMembership()
    const dep = await prisma.projectDependency.findUnique({
      where: { id: dependencyId },
      include: { project: true },
    })
    if (!dep || dep.project.customerAccountId !== portal.customerAccount.id) {
      return { ok: false, error: 'not_found' }
    }
    await prisma.projectDependency.update({
      where: { id: dependencyId },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    })
    await writeProjectActivity({
      projectId: dep.projectId,
      actorUserId: portal.id,
      eventType: 'DEPENDENCY_RESOLVED',
      summary: formatActivitySummary('DEPENDENCY_RESOLVED', dep.title),
    })
    revalidateDashboard()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function postCommentAction(projectId: string, body: string): Promise<ActionResult> {
  try {
    const { portal, project } = await requireProjectAccess(projectId)
    const trimmed = body.trim()
    if (!trimmed) return { ok: false, error: 'empty' }
    await prisma.projectComment.create({
      data: {
        projectId: project.id,
        authorUserId: portal.id,
        body: trimmed,
        visibility: 'CUSTOMER',
      },
    })
    await writeProjectActivity({
      projectId: project.id,
      actorUserId: portal.id,
      eventType: 'COMMENT_POSTED',
      summary: formatActivitySummary('COMMENT_POSTED', trimmed.slice(0, 80)),
    })
    await notificationHooks.onProjectMessage(portal.id, portal.customerAccount.id, trimmed.slice(0, 120), '/dashboard/messages')
    revalidateDashboard()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function respondApprovalAction(
  approvalId: string,
  decision: 'APPROVED' | 'CHANGES_REQUESTED',
  notes?: string,
): Promise<ActionResult> {
  try {
    const portal = await requireCustomerMembership()
    const approval = await prisma.projectApproval.findUnique({
      where: { id: approvalId },
      include: { project: true },
    })
    if (!approval || approval.project.customerAccountId !== portal.customerAccount.id || approval.status !== 'PENDING') {
      return { ok: false, error: 'not_found' }
    }
    await prisma.projectApproval.update({
      where: { id: approvalId },
      data: {
        status: decision,
        respondedAt: new Date(),
        respondedById: portal.id,
        responseNotes: notes?.trim() || null,
      },
    })
    await writeProjectActivity({
      projectId: approval.projectId,
      actorUserId: portal.id,
      eventType: decision === 'APPROVED' ? 'APPROVAL_APPROVED' : 'CHANGES_REQUESTED',
      summary: formatActivitySummary(
        decision === 'APPROVED' ? 'APPROVAL_APPROVED' : 'CHANGES_REQUESTED',
        approval.title,
      ),
    })
    revalidateDashboard()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function submitChangeRequestAction(
  projectId: string,
  title: string,
  description: string,
  priority: ChangeRequestPriority,
): Promise<ActionResult> {
  try {
    const { portal, project } = await requireProjectAccess(projectId)
    const t = title.trim()
    const d = description.trim()
    if (!t || !d) return { ok: false, error: 'empty' }
    await prisma.changeRequest.create({
      data: {
        projectId: project.id,
        submittedById: portal.id,
        title: t,
        description: d,
        priority,
      },
    })
    await writeProjectActivity({
      projectId: project.id,
      actorUserId: portal.id,
      eventType: 'CHANGE_REQUEST_SUBMITTED',
      summary: formatActivitySummary('CHANGE_REQUEST_SUBMITTED', t),
    })
    revalidateDashboard()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function createSupportRequestAction(subject: string, message: string, projectId?: string): Promise<ActionResult> {
  try {
    const portal = await requireCustomerMembership()
    const s = subject.trim()
    const m = message.trim()
    if (!s || !m) return { ok: false, error: 'empty' }
    if (projectId) {
      await requireProjectAccess(projectId)
    }
    await prisma.supportRequest.create({
      data: {
        customerAccountId: portal.customerAccount.id,
        projectId: projectId || null,
        subject: s,
        message: m,
      },
    })
    if (projectId) {
      await writeProjectActivity({
        projectId,
        actorUserId: portal.id,
        eventType: 'SUPPORT_REQUEST_CREATED',
        summary: formatActivitySummary('SUPPORT_REQUEST_CREATED', s),
      })
    }
    revalidateDashboard()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function registerUploadedFileAction(input: {
  projectId: string
  originalName: string
  storageKey: string
  mimeType: string
  size: number
  category: ProjectFileCategory
}): Promise<ActionResult> {
  try {
    const { portal, project } = await requireProjectAccess(input.projectId)
    if (validateUpload(input.mimeType, input.size) !== 'ok') return { ok: false, error: 'invalid' }
    await prisma.projectFile.create({
      data: {
        projectId: project.id,
        uploadedById: portal.id,
        originalName: input.originalName,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        size: input.size,
        category: input.category,
      },
    })
    await writeProjectActivity({
      projectId: project.id,
      actorUserId: portal.id,
      eventType: 'FILE_UPLOADED',
      summary: formatActivitySummary('FILE_UPLOADED', input.originalName),
    })
    revalidateDashboard()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function prepareFileUploadAction(
  projectId: string,
  originalName: string,
  mimeType: string,
  size: number,
): Promise<
  | { ok: true; uploadUrl: string; storageKey: string }
  | { ok: false; error: string }
> {
  try {
    await requireProjectAccess(projectId)
    const validation = validateUpload(mimeType, size)
    if (validation !== 'ok') return { ok: false, error: validation }
    const storageKey = buildStorageKey(projectId, originalName)
    const provider = getStorageProvider()
    const result = await provider.createUpload({ storageKey, mimeType, size })
    if (!result.ok) return { ok: false, error: result.reason }
    return { ok: true, uploadUrl: result.uploadUrl, storageKey: result.storageKey }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}
