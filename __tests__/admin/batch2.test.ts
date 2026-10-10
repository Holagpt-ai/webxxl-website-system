import { beforeEach, describe, expect, it, vi } from 'vitest'
import { canAccessAdminWorkspace } from '@/lib/admin/access'
import { isAdminRole, isStaffRole } from '@/lib/admin/roles'
import { getRegistryEntitlementServiceKeys, isRegistryEntitlementServiceKey } from '@/lib/admin/service-keys'
import {
  parseProgressPercent,
  resolveProjectCompletedAt,
  resolveTaskCompletedAt,
} from '@/lib/admin/validation'
import { canAccessProject, filterCustomerComments } from '@/lib/portal/access-rules'
import { calculateProjectEta } from '@/lib/portal/eta'

const hoisted = vi.hoisted(() => {
  const staffUser = { id: 'staff-1', email: 'staff@example.com', role: 'STAFF' as const }
  const adminUser = { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' as const }
  return {
    staffUser,
    adminUser,
    requireStaff: vi.fn(async () => staffUser),
    requireAdmin: vi.fn(async () => adminUser),
    syncProjectProgressFromEta: vi.fn(async () => null),
    writeProjectActivity: vi.fn(async () => ({})),
    notifyCustomerAccountMembers: vi.fn(async () => undefined),
    onApprovalRequested: vi.fn(async () => undefined),
    revalidatePath: vi.fn(),
    prisma: {
      project: {
        findUnique: vi.fn(),
        update: vi.fn(async () => ({})),
        findFirst: vi.fn(),
      },
      projectTask: {
        findFirst: vi.fn(),
        update: vi.fn(async () => ({})),
        create: vi.fn(async () => ({})),
      },
      projectMilestone: { findFirst: vi.fn() },
      projectDependency: {
        findFirst: vi.fn(),
        create: vi.fn(async () => ({})),
        update: vi.fn(async () => ({})),
      },
      projectApproval: { create: vi.fn(async () => ({})) },
      changeRequest: {
        findUnique: vi.fn(),
        update: vi.fn(async () => ({})),
      },
      projectComment: { create: vi.fn(async () => ({})) },
      customerMembership: { findMany: vi.fn(async () => []) },
      customerAccount: { findUnique: vi.fn(async () => ({ id: 'cust-1' })) },
      customerService: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async () => ({})),
        update: vi.fn(async () => ({})),
      },
    },
  }
})

vi.mock('@/lib/portal/authz', () => ({
  requireStaff: hoisted.requireStaff,
  requireAdmin: hoisted.requireAdmin,
}))

vi.mock('@/lib/db', () => ({ prisma: hoisted.prisma }))

vi.mock('@/lib/admin/sync-project-eta', () => ({
  syncProjectProgressFromEta: hoisted.syncProjectProgressFromEta,
}))

vi.mock('next/cache', () => ({ revalidatePath: hoisted.revalidatePath }))

vi.mock('@/lib/portal/activity', () => ({
  writeProjectActivity: hoisted.writeProjectActivity,
  formatActivitySummary: (_type: string, detail: string) => detail,
}))

vi.mock('@/lib/portal/notifications', () => ({
  notificationHooks: { onApprovalRequested: hoisted.onApprovalRequested, onDependencyRequested: vi.fn() },
}))

vi.mock('@/lib/admin/notify-customers', () => ({
  notifyCustomerAccountMembers: hoisted.notifyCustomerAccountMembers,
}))

describe('admin authorization roles', () => {
  it('denies customers from admin workspace', () => {
    expect(canAccessAdminWorkspace('CUSTOMER')).toBe(false)
    expect(isStaffRole('CUSTOMER')).toBe(false)
    expect(isAdminRole('CUSTOMER')).toBe(false)
  })

  it('allows staff and admin into admin workspace', () => {
    expect(canAccessAdminWorkspace('STAFF')).toBe(true)
    expect(canAccessAdminWorkspace('ADMIN')).toBe(true)
    expect(isStaffRole('STAFF')).toBe(true)
    expect(isAdminRole('ADMIN')).toBe(true)
    expect(isAdminRole('STAFF')).toBe(false)
  })
})

describe('project and customer scoping', () => {
  it('denies cross-customer project access', () => {
    expect(canAccessProject('acct_a', 'acct_b')).toBe(false)
    expect(canAccessProject('acct_a', 'acct_a')).toBe(true)
  })
})

describe('internal notes customer visibility', () => {
  it('hides internal comments from customer-facing filters', () => {
    const comments = [
      { visibility: 'CUSTOMER', body: 'visible' },
      { visibility: 'INTERNAL', body: 'internal handling note' },
    ]
    const visible = filterCustomerComments(comments)
    expect(visible).toHaveLength(1)
    expect(visible[0].body).toBe('visible')
  })
})

describe('ETA integration for admin project updates', () => {
  it('recalculates progress when milestones complete', () => {
    const eta = calculateProjectEta({
      projectStatus: 'ACTIVE',
      targetDate: new Date('2030-06-01'),
      estimatedCompletionDate: null,
      milestones: [
        { title: 'A', status: 'COMPLETED', progressWeight: 50, targetDate: null, completedAt: new Date() },
        { title: 'B', status: 'IN_PROGRESS', progressWeight: 50, targetDate: null, completedAt: null },
      ],
      customerOpenDependencies: [],
    })
    expect(eta.progressPercent).toBe(50)
    expect(eta.currentMilestoneTitle).toBe('B')
  })

  it('reflects waiting on customer when dependencies are open', () => {
    const eta = calculateProjectEta({
      projectStatus: 'ACTIVE',
      targetDate: new Date('2030-06-01'),
      estimatedCompletionDate: null,
      milestones: [{ title: 'Design', status: 'IN_PROGRESS', progressWeight: 100, targetDate: null, completedAt: null }],
      customerOpenDependencies: [{ status: 'REQUESTED', dueDate: null }],
    })
    expect(eta.state).toBe('waiting_on_customer')
  })
})

describe('progress percent validation', () => {
  it('accepts integers 0–100', () => {
    expect(parseProgressPercent(0)).toEqual({ ok: true, value: 0 })
    expect(parseProgressPercent(100)).toEqual({ ok: true, value: 100 })
    expect(parseProgressPercent(42)).toEqual({ ok: true, value: 42 })
  })

  it('rejects non-integers and out-of-range values', () => {
    expect(parseProgressPercent(42.5).ok).toBe(false)
    expect(parseProgressPercent(-1).ok).toBe(false)
    expect(parseProgressPercent(101).ok).toBe(false)
    expect(parseProgressPercent(Number.NaN).ok).toBe(false)
  })
})

describe('project completedAt resolution', () => {
  const fixed = new Date('2026-01-15T12:00:00.000Z')

  it('preserves existing completedAt when already completed', () => {
    const existing = new Date('2025-06-01T00:00:00.000Z')
    expect(resolveProjectCompletedAt('COMPLETED', 'COMPLETED', existing, fixed)).toBe(existing)
  })

  it('sets completedAt when newly completed', () => {
    expect(resolveProjectCompletedAt('ACTIVE', 'COMPLETED', null, fixed)).toEqual(fixed)
  })

  it('clears completedAt when reopening from completed', () => {
    expect(resolveProjectCompletedAt('COMPLETED', 'ACTIVE', new Date(), fixed)).toBe(null)
  })
})

describe('task completedAt resolution', () => {
  const fixed = new Date('2026-01-15T12:00:00.000Z')
  const doneAt = new Date('2025-12-01T00:00:00.000Z')

  it('sets completedAt when transitioning to DONE', () => {
    expect(resolveTaskCompletedAt('TODO', 'DONE', null, fixed)).toEqual(fixed)
  })

  it('preserves completedAt when remaining DONE', () => {
    expect(resolveTaskCompletedAt('DONE', 'DONE', doneAt, fixed)).toBe(doneAt)
  })

  it('clears completedAt when reopening from DONE', () => {
    expect(resolveTaskCompletedAt('DONE', 'IN_PROGRESS', doneAt, fixed)).toBe(null)
  })
})

describe('registry service keys', () => {
  it('derives allowed keys from module registry', () => {
    const keys = getRegistryEntitlementServiceKeys()
    expect(keys.has('scheduler')).toBe(true)
    expect(isRegistryEntitlementServiceKey('scheduler')).toBe(true)
    expect(isRegistryEntitlementServiceKey('not-a-real-module-key')).toBe(false)
  })
})

describe('admin server actions (mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.requireStaff.mockImplementation(async () => hoisted.staffUser)
    hoisted.requireAdmin.mockImplementation(async () => hoisted.adminUser)
  })

  it('updateProjectAction persists explicit progress and preserves it during ETA sync', async () => {
    const { updateProjectAction } = await import('@/lib/admin/actions')
    hoisted.prisma.project.findUnique.mockResolvedValue({
      id: 'proj-1',
      status: 'ACTIVE',
      completedAt: null,
    })

    const result = await updateProjectAction('proj-1', { progressPercent: 73 })

    expect(result).toEqual({ ok: true })
    expect(hoisted.prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'proj-1' },
        data: expect.objectContaining({ progressPercent: 73 }),
      }),
    )
    expect(hoisted.syncProjectProgressFromEta).toHaveBeenCalledWith('proj-1', { preserveProgressPercent: true })
  })

  it('updateProjectAction rejects invalid progress server-side', async () => {
    const { updateProjectAction } = await import('@/lib/admin/actions')
    hoisted.prisma.project.findUnique.mockResolvedValue({
      id: 'proj-1',
      status: 'ACTIVE',
      completedAt: null,
    })

    const result = await updateProjectAction('proj-1', { progressPercent: 150 })

    expect(result).toEqual({ ok: false, error: 'invalid_progress' })
    expect(hoisted.prisma.project.update).not.toHaveBeenCalled()
  })

  it('updateProjectAction clears completedAt when leaving COMPLETED', async () => {
    const { updateProjectAction } = await import('@/lib/admin/actions')
    hoisted.prisma.project.findUnique.mockResolvedValue({
      id: 'proj-1',
      status: 'COMPLETED',
      completedAt: new Date('2025-01-01'),
    })

    await updateProjectAction('proj-1', { status: 'ACTIVE' })

    expect(hoisted.prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE', completedAt: null }),
      }),
    )
  })

  it('upsertTaskAction clears completedAt when task is reopened', async () => {
    const { upsertTaskAction } = await import('@/lib/admin/actions')
    hoisted.prisma.project.findUnique.mockResolvedValue({ id: 'proj-1' })
    hoisted.prisma.projectTask.findFirst.mockResolvedValue({
      id: 'task-1',
      projectId: 'proj-1',
      status: 'DONE',
      completedAt: new Date('2025-05-01'),
    })

    await upsertTaskAction('proj-1', { id: 'task-1', title: 'Review', status: 'IN_PROGRESS' })

    expect(hoisted.prisma.projectTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'IN_PROGRESS', completedAt: null }),
      }),
    )
  })

  it('upsertDependencyAction rejects milestone from another project', async () => {
    const { upsertDependencyAction } = await import('@/lib/admin/actions')
    hoisted.prisma.project.findUnique.mockResolvedValue({ id: 'proj-a', customerAccountId: 'cust-1' })
    hoisted.prisma.projectMilestone.findFirst.mockResolvedValue(null)

    const result = await upsertDependencyAction('proj-a', {
      title: 'Need assets',
      milestoneId: 'ms-other-project',
    })

    expect(result).toEqual({ ok: false, error: 'not_found' })
    expect(hoisted.prisma.projectDependency.create).not.toHaveBeenCalled()
  })

  it('createApprovalRequestAction writes approval and activity as staff', async () => {
    const { createApprovalRequestAction } = await import('@/lib/admin/actions')
    hoisted.prisma.project.findUnique.mockResolvedValue({ id: 'proj-1', customerAccountId: 'cust-1' })

    const result = await createApprovalRequestAction('proj-1', 'Sign-off homepage', 'Please review')

    expect(result).toEqual({ ok: true })
    expect(hoisted.requireStaff).toHaveBeenCalled()
    expect(hoisted.prisma.projectApproval.create).toHaveBeenCalled()
    expect(hoisted.writeProjectActivity).toHaveBeenCalled()
  })

  it('updateChangeRequestStatusAction requires staff and updates record', async () => {
    const { updateChangeRequestStatusAction } = await import('@/lib/admin/actions')
    hoisted.prisma.changeRequest.findUnique.mockResolvedValue({
      id: 'cr-1',
      projectId: 'proj-1',
      title: 'Add page',
      project: { customerAccountId: 'cust-1' },
    })

    const result = await updateChangeRequestStatusAction('cr-1', 'REVIEWING')

    expect(result).toEqual({ ok: true })
    expect(hoisted.requireStaff).toHaveBeenCalled()
    expect(hoisted.prisma.changeRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cr-1' }, data: { status: 'REVIEWING' } }),
    )
    expect(hoisted.writeProjectActivity).toHaveBeenCalled()
  })

  it('upsertCustomerServiceAction allows ADMIN with valid registry key', async () => {
    const { upsertCustomerServiceAction } = await import('@/lib/admin/actions')
    hoisted.prisma.project.findFirst.mockResolvedValue(null)

    const result = await upsertCustomerServiceAction('cust-1', 'scheduler', 'ACTIVE')

    expect(result).toEqual({ ok: true })
    expect(hoisted.requireAdmin).toHaveBeenCalled()
    expect(hoisted.prisma.customerService.create).toHaveBeenCalled()
  })

  it('upsertCustomerServiceAction rejects unknown service keys', async () => {
    const { upsertCustomerServiceAction } = await import('@/lib/admin/actions')

    const result = await upsertCustomerServiceAction('cust-1', 'fake-billing-module', 'ACTIVE')

    expect(result).toEqual({ ok: false, error: 'invalid_service' })
    expect(hoisted.prisma.customerService.create).not.toHaveBeenCalled()
  })

  it('upsertCustomerServiceAction rejects STAFF even with valid key', async () => {
    const { upsertCustomerServiceAction } = await import('@/lib/admin/actions')
    hoisted.requireAdmin.mockRejectedValue(new Error('Admin access required'))

    const result = await upsertCustomerServiceAction('cust-1', 'scheduler', 'ACTIVE')

    expect(result).toEqual({ ok: false, error: 'unauthorized' })
    expect(hoisted.prisma.customerService.create).not.toHaveBeenCalled()
  })
})
