'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireCustomerMembership, requireProjectAccess } from '@/lib/portal/authz'
import { writeProjectActivity, formatActivitySummary } from '@/lib/portal/activity'
import { notifyStaffUsers } from '@/lib/portal/notifications'
import { buildCustomerCommentWrite } from '@/lib/files/comments'
import { assertFilesBelongToProject, linkProjectFiles, readUploadFromFormData, uploadProjectFile } from '@/lib/files/operations'
import type { ChangeRequestPriority } from '@prisma/client'

export type ActionResult = { ok: true } | { ok: false; error: string }

function revalidateDashboard() {
  revalidatePath('/dashboard', 'layout')
  revalidatePath('/es/dashboard', 'layout')
}

async function bestEffort(task: Promise<unknown>) {
  try {
    await task
  } catch {
    // The domain write already succeeded. Notification delivery stays best-effort.
  }
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
    const write = buildCustomerCommentWrite({
      projectId: project.id,
      authorUserId: portal.id,
      body,
    })
    if (!write.ok) return write
    await prisma.projectComment.create({ data: write.data })
    await writeProjectActivity({
      projectId: project.id,
      actorUserId: portal.id,
      eventType: 'COMMENT_POSTED',
      summary: formatActivitySummary('COMMENT_POSTED', write.data.body.slice(0, 80)),
    })
    await bestEffort(
      notifyStaffUsers({
        type: 'PROJECT_MESSAGE',
        title: 'New customer message',
        body: write.data.body.slice(0, 120),
        actionUrl: `/admin/projects/${project.id}`,
        customerAccountId: portal.customerAccount.id,
      }),
    )
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
  fileIds: string[] = [],
): Promise<ActionResult> {
  try {
    const { portal, project } = await requireProjectAccess(projectId)
    const t = title.trim()
    const d = description.trim()
    if (!t || !d) return { ok: false, error: 'empty' }
    const filesOk = await assertFilesBelongToProject(fileIds, project.id)
    if (!filesOk.ok) return filesOk
    const created = await prisma.changeRequest.create({
      data: {
        projectId: project.id,
        submittedById: portal.id,
        title: t,
        description: d,
        priority,
      },
    })
    if (fileIds.length > 0) {
      const linked = await linkProjectFiles({
        targetProjectId: project.id,
        fileIds,
        changeRequestId: created.id,
      })
      if (!linked.ok) return linked
      await bestEffort(
        notifyStaffUsers({
          type: 'GENERAL',
          title: 'Files attached to a change request',
          body: t,
          actionUrl: '/admin/requests',
          customerAccountId: portal.customerAccount.id,
        }),
      )
    }
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

export async function createSupportRequestAction(
  subject: string,
  message: string,
  projectId?: string,
  fileIds: string[] = [],
): Promise<ActionResult> {
  try {
    const portal = await requireCustomerMembership()
    const s = subject.trim()
    const m = message.trim()
    if (!s || !m) return { ok: false, error: 'empty' }
    let scopedProjectId: string | null = null
    if (projectId) {
      const access = await requireProjectAccess(projectId)
      scopedProjectId = access.project.id
    }
    if (fileIds.length > 0) {
      if (!scopedProjectId) return { ok: false, error: 'cross_project' }
      const filesOk = await assertFilesBelongToProject(fileIds, scopedProjectId)
      if (!filesOk.ok) return filesOk
    }
    const created = await prisma.supportRequest.create({
      data: {
        customerAccountId: portal.customerAccount.id,
        projectId: scopedProjectId,
        subject: s,
        message: m,
      },
    })
    if (fileIds.length > 0 && scopedProjectId) {
      const linked = await linkProjectFiles({
        targetProjectId: scopedProjectId,
        fileIds,
        supportRequestId: created.id,
      })
      if (!linked.ok) return linked
      await bestEffort(
        notifyStaffUsers({
          type: 'GENERAL',
          title: 'Files attached to a support request',
          body: s,
          actionUrl: '/admin/support',
          customerAccountId: portal.customerAccount.id,
        }),
      )
    }
    if (scopedProjectId) {
      await writeProjectActivity({
        projectId: scopedProjectId,
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

export async function uploadProjectFileAction(formData: FormData): Promise<ActionResult> {
  try {
    const parsed = await readUploadFromFormData(formData)
    if (!parsed.ok) return parsed
    const { portal, project } = await requireProjectAccess(parsed.projectId)
    const uploaded = await uploadProjectFile({
      actorUserId: portal.id,
      projectId: project.id,
      originalName: parsed.originalName,
      mimeType: parsed.mimeType,
      size: parsed.size,
      bytes: parsed.bytes,
      category: parsed.category,
    })
    if (!uploaded.ok) return uploaded
    await bestEffort(
      notifyStaffUsers({
        type: 'GENERAL',
        title: 'Customer uploaded a file',
        body: parsed.originalName,
        actionUrl: `/admin/projects/${project.id}`,
        customerAccountId: portal.customerAccount.id,
      }),
    )
    revalidateDashboard()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}
