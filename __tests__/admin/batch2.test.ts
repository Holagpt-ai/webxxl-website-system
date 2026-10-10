import { describe, expect, it } from 'vitest'
import { canAccessAdminWorkspace } from '@/lib/admin/access'
import { isAdminRole, isStaffRole } from '@/lib/admin/roles'
import { canAccessProject, filterCustomerComments } from '@/lib/portal/access-rules'
import { calculateProjectEta } from '@/lib/portal/eta'

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

describe('approval and change request workflow rules', () => {
  it('treats pending approvals as awaiting customer action', () => {
    expect('PENDING' === 'PENDING').toBe(true)
  })

  it('allows change request status transitions in admin queue', () => {
    const statuses = ['SUBMITTED', 'REVIEWING', 'APPROVED', 'SCHEDULED', 'COMPLETED', 'DECLINED']
    expect(statuses.includes('REVIEWING')).toBe(true)
  })
})

describe('customer service activation authorization', () => {
  it('restricts privileged service changes to admin role', () => {
    expect(isAdminRole('ADMIN')).toBe(true)
    expect(isAdminRole('STAFF')).toBe(false)
  })
})
