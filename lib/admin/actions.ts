'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireAdmin, requireStaff } from '@/lib/portal/authz'
import { writeProjectActivity, formatActivitySummary } from '@/lib/portal/activity'
import { notificationHooks } from '@/lib/portal/notifications'
import { syncProjectProgressFromEta } from '@/lib/admin/sync-project-eta'
import { notifyCustomerAccountMembers } from '@/lib/admin/notify-customers'
import { buildStaffCommentWrite } from '@/lib/files/comments'
import { canDeleteProjectFile } from '@/lib/files/access'
import { deleteStoredProjectFile, linkProjectFiles, readUploadFromFormData, uploadProjectFile } from '@/lib/files/operations'
import { isRegistryEntitlementServiceKey } from '@/lib/admin/service-keys'
import { parseProgressPercent, resolveProjectCompletedAt, resolveTaskCompletedAt } from '@/lib/admin/validation'
import type {
  ChangeRequestStatus,
  CustomerAccountStatus,
  CustomerServiceStatus,
  DependencyStatus,
  MembershipRole,
  MilestoneStatus,
  ProjectStatus,
  ProjectType,
  SupportRequestStatus,
  TaskStatus,
} from '@prisma/client'

export type AdminActionResult = { ok: true } | { ok: false; error: string }

function revalidateAdmin() {
  revalidatePath('/admin', 'layout')
  revalidatePath('/es/admin', 'layout')
  revalidatePath('/dashboard', 'layout')
  revalidatePath('/es/dashboard', 'layout')
}

async function bestEffort(task: Promise<unknown>) {
  try {
    await task
  } catch {
    // Domain write already succeeded.
  }
}

async function loadProjectForStaff(projectId: string) {
  await requireStaff()
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) throw new Error('not_found')
  return project
}

async function assertMilestoneBelongsToProject(projectId: string, milestoneId: string) {
  const ms = await prisma.projectMilestone.findFirst({ where: { id: milestoneId, projectId } })
  if (!ms) throw new Error('not_found')
  return ms
}

export async function updateCustomerAccountStatusAction(
  customerId: string,
  status: CustomerAccountStatus,
): Promise<AdminActionResult> {
  try {
    await requireStaff()
    const account = await prisma.customerAccount.findUnique({ where: { id: customerId } })
    if (!account) return { ok: false, error: 'not_found' }
    await prisma.customerAccount.update({ where: { id: customerId }, data: { status } })
    revalidateAdmin()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function addCustomerMembershipAction(
  customerId: string,
  email: string,
  role: MembershipRole,
): Promise<AdminActionResult> {
  try {
    await requireAdmin()
    const normalized = email.trim().toLowerCase()
    if (!normalized) return { ok: false, error: 'empty' }
    const account = await prisma.customerAccount.findUnique({ where: { id: customerId } })
    if (!account) return { ok: false, error: 'not_found' }
    const user = await prisma.user.findUnique({ where: { email: normalized } })
    if (!user) return { ok: false, error: 'user_not_found' }
    await prisma.customerMembership.upsert({
      where: { userId_customerAccountId: { userId: user.id, customerAccountId: customerId } },
      create: { userId: user.id, customerAccountId: customerId, role },
      update: { role },
    })
    revalidateAdmin()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function updateMembershipRoleAction(membershipId: string, role: MembershipRole): Promise<AdminActionResult> {
  try {
    await requireAdmin()
    const membership = await prisma.customerMembership.findUnique({ where: { id: membershipId } })
    if (!membership) return { ok: false, error: 'not_found' }
    await prisma.customerMembership.update({ where: { id: membershipId }, data: { role } })
    revalidateAdmin()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function removeMembershipAction(membershipId: string): Promise<AdminActionResult> {
  try {
    await requireAdmin()
    const membership = await prisma.customerMembership.findUnique({ where: { id: membershipId } })
    if (!membership) return { ok: false, error: 'not_found' }
    const count = await prisma.customerMembership.count({ where: { customerAccountId: membership.customerAccountId } })
    if (count <= 1) return { ok: false, error: 'last_member' }
    await prisma.customerMembership.delete({ where: { id: membershipId } })
    revalidateAdmin()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function createProjectAction(input: {
  customerAccountId: string
  name: string
  type: ProjectType
  status?: ProjectStatus
  summary?: string
}): Promise<AdminActionResult & { projectId?: string }> {
  try {
    const staff = await requireStaff()
    const name = input.name.trim()
    if (!name) return { ok: false, error: 'empty' }
    const account = await prisma.customerAccount.findUnique({ where: { id: input.customerAccountId } })
    if (!account) return { ok: false, error: 'not_found' }
    const project = await prisma.project.create({
      data: {
        customerAccountId: input.customerAccountId,
        name,
        type: input.type,
        status: input.status ?? 'ACTIVE',
        summary: input.summary?.trim() || null,
      },
    })
    await writeProjectActivity({
      projectId: project.id,
      actorUserId: staff.id,
      eventType: 'PROJECT_CREATED',
      summary: formatActivitySummary('PROJECT_CREATED', name),
    })
    await syncProjectProgressFromEta(project.id)
    revalidateAdmin()
    return { ok: true, projectId: project.id }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function updateProjectAction(
  projectId: string,
  data: {
    name?: string
    status?: ProjectStatus
    progressPercent?: number
    targetDate?: string | null
    summary?: string | null
  },
): Promise<AdminActionResult> {
  try {
    const staff = await requireStaff()
    const project = await loadProjectForStaff(projectId)
    const prevStatus = project.status
    let explicitProgress: number | undefined
    const update: {
      name?: string
      status?: ProjectStatus
      progressPercent?: number
      targetDate?: Date | null
      summary?: string | null
      completedAt?: Date | null
    } = {}
    if (data.name !== undefined) update.name = data.name.trim()
    if (data.status !== undefined) {
      update.status = data.status
      const completedAt = resolveProjectCompletedAt(prevStatus, data.status, project.completedAt)
      if (completedAt !== undefined) update.completedAt = completedAt
    }
    if (data.progressPercent !== undefined) {
      const parsed = parseProgressPercent(data.progressPercent)
      if (!parsed.ok) return { ok: false, error: parsed.error }
      explicitProgress = parsed.value
      update.progressPercent = parsed.value
    }
    if (data.targetDate !== undefined) update.targetDate = data.targetDate ? new Date(data.targetDate) : null
    if (data.summary !== undefined) update.summary = data.summary?.trim() || null

    await prisma.project.update({ where: { id: projectId }, data: update })

    if (data.status !== undefined && data.status !== prevStatus) {
      await writeProjectActivity({
        projectId,
        actorUserId: staff.id,
        eventType: 'TASK_COMPLETED',
        summary: `Project status updated: ${prevStatus} → ${data.status}`,
      })
    }
    await syncProjectProgressFromEta(projectId, {
      preserveProgressPercent: explicitProgress !== undefined,
    })
    revalidateAdmin()
    return { ok: true }
  } catch (e) {
    if (e instanceof Error && e.message === 'not_found') return { ok: false, error: 'not_found' }
    return { ok: false, error: 'unauthorized' }
  }
}

export async function upsertMilestoneAction(
  projectId: string,
  input: {
    id?: string
    title: string
    description?: string
    sortOrder?: number
    status?: MilestoneStatus
    progressWeight?: number
    targetDate?: string | null
  },
): Promise<AdminActionResult> {
  try {
    const staff = await requireStaff()
    await loadProjectForStaff(projectId)
    const title = input.title.trim()
    if (!title) return { ok: false, error: 'empty' }

    if (input.id) {
      const existing = await prisma.projectMilestone.findFirst({ where: { id: input.id, projectId } })
      if (!existing) return { ok: false, error: 'not_found' }
      const prevStatus = existing.status
      const status = input.status ?? existing.status
      const completedAt =
        status === 'COMPLETED' && existing.status !== 'COMPLETED'
          ? new Date()
          : status === 'COMPLETED'
            ? existing.completedAt
            : null
      await prisma.projectMilestone.update({
        where: { id: input.id },
        data: {
          title,
          description: input.description?.trim() || null,
          sortOrder: input.sortOrder ?? existing.sortOrder,
          status,
          progressWeight: input.progressWeight ?? existing.progressWeight,
          targetDate: input.targetDate !== undefined ? (input.targetDate ? new Date(input.targetDate) : null) : undefined,
          completedAt,
        },
      })
      if (status === 'IN_PROGRESS' && prevStatus !== 'IN_PROGRESS') {
        await writeProjectActivity({
          projectId,
          actorUserId: staff.id,
          eventType: 'MILESTONE_STARTED',
          summary: formatActivitySummary('MILESTONE_STARTED', title),
        })
        await notifyCustomerAccountMembers({
          customerAccountId: (await prisma.project.findUnique({ where: { id: projectId } }))!.customerAccountId,
          type: 'MILESTONE_UPDATE',
          title: 'Milestone update',
          body: title,
          actionUrl: '/dashboard/project',
        })
      }
      if (status === 'COMPLETED' && prevStatus !== 'COMPLETED') {
        await writeProjectActivity({
          projectId,
          actorUserId: staff.id,
          eventType: 'MILESTONE_COMPLETED',
          summary: formatActivitySummary('MILESTONE_COMPLETED', title),
        })
        await notifyCustomerAccountMembers({
          customerAccountId: (await prisma.project.findUnique({ where: { id: projectId } }))!.customerAccountId,
          type: 'MILESTONE_UPDATE',
          title: 'Milestone completed',
          body: title,
          actionUrl: '/dashboard/project',
        })
      }
    } else {
      await prisma.projectMilestone.create({
        data: {
          projectId,
          title,
          description: input.description?.trim() || null,
          sortOrder: input.sortOrder ?? 0,
          status: input.status ?? 'PENDING',
          progressWeight: input.progressWeight ?? 10,
          targetDate: input.targetDate ? new Date(input.targetDate) : null,
        },
      })
    }
    await syncProjectProgressFromEta(projectId)
    revalidateAdmin()
    return { ok: true }
  } catch (e) {
    if (e instanceof Error && e.message === 'not_found') return { ok: false, error: 'not_found' }
    return { ok: false, error: 'unauthorized' }
  }
}

export async function upsertTaskAction(
  projectId: string,
  input: {
    id?: string
    title: string
    milestoneId?: string | null
    status?: TaskStatus
    dueDate?: string | null
  },
): Promise<AdminActionResult> {
  try {
    const staff = await requireStaff()
    await loadProjectForStaff(projectId)
    const title = input.title.trim()
    if (!title) return { ok: false, error: 'empty' }

    if (input.milestoneId) {
      try {
        await assertMilestoneBelongsToProject(projectId, input.milestoneId)
      } catch {
        return { ok: false, error: 'not_found' }
      }
    }

    if (input.id) {
      const existing = await prisma.projectTask.findFirst({ where: { id: input.id, projectId } })
      if (!existing) return { ok: false, error: 'not_found' }
      const status = input.status ?? existing.status
      const completedAt = resolveTaskCompletedAt(existing.status, status, existing.completedAt)
      await prisma.projectTask.update({
        where: { id: input.id },
        data: {
          title,
          milestoneId: input.milestoneId !== undefined ? input.milestoneId : undefined,
          status,
          dueDate: input.dueDate !== undefined ? (input.dueDate ? new Date(input.dueDate) : null) : undefined,
          ...(completedAt !== undefined ? { completedAt } : {}),
        },
      })
      if (status === 'DONE' && existing.status !== 'DONE') {
        await writeProjectActivity({
          projectId,
          actorUserId: staff.id,
          eventType: 'TASK_COMPLETED',
          summary: formatActivitySummary('TASK_COMPLETED', title),
        })
      }
    } else {
      await prisma.projectTask.create({
        data: {
          projectId,
          title,
          milestoneId: input.milestoneId || null,
          status: input.status ?? 'TODO',
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
        },
      })
    }
    revalidateAdmin()
    return { ok: true }
  } catch (e) {
    if (e instanceof Error && e.message === 'not_found') return { ok: false, error: 'not_found' }
    return { ok: false, error: 'unauthorized' }
  }
}

export async function upsertDependencyAction(
  projectId: string,
  input: {
    id?: string
    title: string
    description?: string
    status?: DependencyStatus
    dueDate?: string | null
    milestoneId?: string | null
  },
): Promise<AdminActionResult> {
  try {
    const staff = await requireStaff()
    const project = await loadProjectForStaff(projectId)
    const title = input.title.trim()
    if (!title) return { ok: false, error: 'empty' }

    if (input.milestoneId) {
      try {
        await assertMilestoneBelongsToProject(projectId, input.milestoneId)
      } catch {
        return { ok: false, error: 'not_found' }
      }
    }

    if (input.id) {
      const existing = await prisma.projectDependency.findFirst({ where: { id: input.id, projectId } })
      if (!existing) return { ok: false, error: 'not_found' }
      const status = input.status ?? existing.status
      await prisma.projectDependency.update({
        where: { id: input.id },
        data: {
          title,
          description: input.description?.trim() || null,
          status,
          dueDate: input.dueDate !== undefined ? (input.dueDate ? new Date(input.dueDate) : null) : undefined,
          milestoneId: input.milestoneId !== undefined ? input.milestoneId : undefined,
          resolvedAt: status === 'RESOLVED' ? new Date() : null,
        },
      })
      if (status === 'RESOLVED' && existing.status !== 'RESOLVED') {
        await writeProjectActivity({
          projectId,
          actorUserId: staff.id,
          eventType: 'DEPENDENCY_RESOLVED',
          summary: formatActivitySummary('DEPENDENCY_RESOLVED', title),
        })
      }
    } else {
      await prisma.projectDependency.create({
        data: {
          projectId,
          title,
          description: input.description?.trim() || null,
          status: input.status ?? 'REQUESTED',
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          milestoneId: input.milestoneId || null,
        },
      })
      await writeProjectActivity({
        projectId,
        actorUserId: staff.id,
        eventType: 'DEPENDENCY_REQUESTED',
        summary: formatActivitySummary('DEPENDENCY_REQUESTED', title),
      })
      const memberships = await prisma.customerMembership.findMany({
        where: { customerAccountId: project.customerAccountId },
        take: 1,
      })
      const member = memberships[0]
      if (member) {
        await notificationHooks.onDependencyRequested(member.userId, project.customerAccountId, title, '/dashboard')
      }
    }
    await syncProjectProgressFromEta(projectId)
    revalidateAdmin()
    return { ok: true }
  } catch (e) {
    if (e instanceof Error && e.message === 'not_found') return { ok: false, error: 'not_found' }
    return { ok: false, error: 'unauthorized' }
  }
}

export async function createApprovalRequestAction(
  projectId: string,
  title: string,
  description?: string,
): Promise<AdminActionResult> {
  try {
    const staff = await requireStaff()
    const project = await loadProjectForStaff(projectId)
    const t = title.trim()
    if (!t) return { ok: false, error: 'empty' }
    await prisma.projectApproval.create({
      data: {
        projectId,
        title: t,
        description: description?.trim() || null,
        status: 'PENDING',
      },
    })
    await writeProjectActivity({
      projectId,
      actorUserId: staff.id,
      eventType: 'APPROVAL_REQUESTED',
      summary: formatActivitySummary('APPROVAL_REQUESTED', t),
    })
    const memberships = await prisma.customerMembership.findMany({
      where: { customerAccountId: project.customerAccountId },
      take: 1,
    })
    const member = memberships[0]
    if (member) {
      await notificationHooks.onApprovalRequested(member.userId, project.customerAccountId, t, '/dashboard/approvals')
    }
    revalidateAdmin()
    return { ok: true }
  } catch (e) {
    if (e instanceof Error && e.message === 'not_found') return { ok: false, error: 'not_found' }
    return { ok: false, error: 'unauthorized' }
  }
}

export async function uploadStaffProjectFileAction(formData: FormData): Promise<AdminActionResult> {
  try {
    const staff = await requireStaff()
    const parsed = await readUploadFromFormData(formData)
    if (!parsed.ok) return parsed
    const project = await loadProjectForStaff(parsed.projectId)
    const uploaded = await uploadProjectFile({
      actorUserId: staff.id,
      projectId: project.id,
      originalName: parsed.originalName,
      mimeType: parsed.mimeType,
      size: parsed.size,
      bytes: parsed.bytes,
      category: parsed.category,
    })
    if (!uploaded.ok) return uploaded
    await bestEffort(
      notifyCustomerAccountMembers({
        customerAccountId: project.customerAccountId,
        type: 'GENERAL',
        title: 'A file was added to your project',
        body: parsed.originalName,
        actionUrl: '/dashboard/files',
      }),
    )
    revalidateAdmin()
    return { ok: true }
  } catch (e) {
    if (e instanceof Error && e.message === 'not_found') return { ok: false, error: 'not_found' }
    return { ok: false, error: 'unauthorized' }
  }
}

export async function deleteProjectFileAction(projectId: string, fileId: string): Promise<AdminActionResult> {
  try {
    const staff = await requireStaff()
    if (!canDeleteProjectFile(staff.role)) return { ok: false, error: 'unauthorized' }
    const project = await loadProjectForStaff(projectId)
    const removed = await deleteStoredProjectFile({
      actorUserId: staff.id,
      projectId: project.id,
      fileId,
    })
    if (!removed.ok) return removed
    revalidateAdmin()
    return { ok: true }
  } catch (e) {
    if (e instanceof Error && e.message === 'not_found') return { ok: false, error: 'not_found' }
    return { ok: false, error: 'unauthorized' }
  }
}

export async function postStaffProjectCommentAction(
  projectId: string,
  body: string,
  visibility: string,
): Promise<AdminActionResult> {
  try {
    const staff = await requireStaff()
    const project = await loadProjectForStaff(projectId)
    const write = buildStaffCommentWrite({
      projectId: project.id,
      authorUserId: staff.id,
      body,
      visibility,
    })
    if (!write.ok) return { ok: false, error: write.error === 'invalid_visibility' ? 'invalid' : write.error }
    await prisma.projectComment.create({ data: write.data })
    await writeProjectActivity({
      projectId: project.id,
      actorUserId: staff.id,
      eventType: 'COMMENT_POSTED',
      summary: formatActivitySummary('COMMENT_POSTED', write.data.body.slice(0, 80)),
    })
    if (write.data.visibility === 'CUSTOMER') {
      await bestEffort(
        notifyCustomerAccountMembers({
          customerAccountId: project.customerAccountId,
          type: 'PROJECT_MESSAGE',
          title: 'New project message',
          body: write.data.body.slice(0, 120),
          actionUrl: '/dashboard/messages',
        }),
      )
    }
    revalidateAdmin()
    return { ok: true }
  } catch (e) {
    if (e instanceof Error && e.message === 'not_found') return { ok: false, error: 'not_found' }
    return { ok: false, error: 'unauthorized' }
  }
}

export async function attachApprovalFilesAction(
  projectId: string,
  approvalId: string,
  fileIds: string[],
): Promise<AdminActionResult> {
  try {
    const project = await loadProjectForStaff(projectId)
    const approval = await prisma.projectApproval.findFirst({
      where: { id: approvalId, projectId: project.id },
    })
    if (!approval) return { ok: false, error: 'not_found' }
    const linked = await linkProjectFiles({
      targetProjectId: project.id,
      fileIds,
      approvalId: approval.id,
    })
    if (!linked.ok) return linked
    if (fileIds.length > 0) {
      await bestEffort(
        notifyCustomerAccountMembers({
          customerAccountId: project.customerAccountId,
          type: 'APPROVAL_REQUESTED',
          title: 'Review files added',
          body: approval.title,
          actionUrl: '/dashboard/approvals',
        }),
      )
    }
    revalidateAdmin()
    return { ok: true }
  } catch (e) {
    if (e instanceof Error && e.message === 'not_found') return { ok: false, error: 'not_found' }
    return { ok: false, error: 'unauthorized' }
  }
}

export async function updateChangeRequestStatusAction(
  changeRequestId: string,
  status: ChangeRequestStatus,
  internalNote?: string,
): Promise<AdminActionResult> {
  try {
    const staff = await requireStaff()
    const cr = await prisma.changeRequest.findUnique({
      where: { id: changeRequestId },
      include: { project: true },
    })
    if (!cr) return { ok: false, error: 'not_found' }
    await prisma.changeRequest.update({ where: { id: changeRequestId }, data: { status } })
    await writeProjectActivity({
      projectId: cr.projectId,
      actorUserId: staff.id,
      eventType: 'CHANGE_REQUEST_SUBMITTED',
      summary: `Change request status updated: ${cr.title} → ${status}`,
    })
    if (internalNote?.trim()) {
      await prisma.projectComment.create({
        data: {
          projectId: cr.projectId,
          authorUserId: staff.id,
          body: internalNote.trim(),
          visibility: 'INTERNAL',
        },
      })
    }
    await notifyCustomerAccountMembers({
      customerAccountId: cr.project.customerAccountId,
      type: 'CHANGE_REQUEST_UPDATE',
      title: 'Change request update',
      body: `${cr.title}: ${status}`,
      actionUrl: '/dashboard/requests',
    })
    revalidateAdmin()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function updateSupportRequestStatusAction(
  supportRequestId: string,
  status: SupportRequestStatus,
): Promise<AdminActionResult> {
  try {
    const staff = await requireStaff()
    const sr = await prisma.supportRequest.findUnique({ where: { id: supportRequestId } })
    if (!sr) return { ok: false, error: 'not_found' }
    await prisma.supportRequest.update({ where: { id: supportRequestId }, data: { status } })
    if (sr.projectId) {
      await writeProjectActivity({
        projectId: sr.projectId,
        actorUserId: staff.id,
        eventType: 'SUPPORT_REQUEST_CREATED',
        summary: `Support request ${sr.subject} → ${status}`,
      })
    }
    revalidateAdmin()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function upsertCustomerServiceAction(
  customerAccountId: string,
  serviceKey: string,
  status: CustomerServiceStatus,
): Promise<AdminActionResult> {
  try {
    const staff = await requireAdmin()
    const key = serviceKey.trim()
    if (!key) return { ok: false, error: 'empty' }
    if (!isRegistryEntitlementServiceKey(key)) return { ok: false, error: 'invalid_service' }
    const account = await prisma.customerAccount.findUnique({ where: { id: customerAccountId } })
    if (!account) return { ok: false, error: 'not_found' }

    const existing = await prisma.customerService.findUnique({
      where: { customerAccountId_serviceKey: { customerAccountId, serviceKey: key } },
    })

    if (existing) {
      await prisma.customerService.update({
        where: { id: existing.id },
        data: {
          status,
          activatedAt: status === 'ACTIVE' ? existing.activatedAt ?? new Date() : existing.activatedAt,
          deactivatedAt: status === 'INACTIVE' ? new Date() : null,
        },
      })
    } else {
      await prisma.customerService.create({
        data: {
          customerAccountId,
          serviceKey: key,
          status,
          activatedAt: status === 'ACTIVE' ? new Date() : null,
        },
      })
    }

    const project = await prisma.project.findFirst({
      where: { customerAccountId },
      orderBy: { updatedAt: 'desc' },
    })
    if (project) {
      await writeProjectActivity({
        projectId: project.id,
        actorUserId: staff.id,
        eventType: 'TASK_COMPLETED',
        summary: `Service ${key} set to ${status}`,
      })
    }
    revalidateAdmin()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}
