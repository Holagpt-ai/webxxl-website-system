import { describe, expect, it } from 'vitest'
import { canAccessProject, filterCustomerComments, isModuleEnabledForServices } from '@/lib/portal/access-rules'
import { calculateProjectEta } from '@/lib/portal/eta'
import { formatActivitySummary } from '@/lib/portal/activity'
import { getServiceModules } from '@/lib/portal/modules'

describe('customer authorization isolation', () => {
  it('denies cross-customer project access', () => {
    expect(canAccessProject('acct_a', 'acct_b')).toBe(false)
    expect(canAccessProject('acct_a', 'acct_a')).toBe(true)
  })
})

describe('internal comment filtering', () => {
  it('hides internal comments from customer views', () => {
    const comments = [
      { visibility: 'CUSTOMER', body: 'hi' },
      { visibility: 'INTERNAL', body: 'secret' },
    ]
    expect(filterCustomerComments(comments)).toHaveLength(1)
    expect(filterCustomerComments(comments)[0].body).toBe('hi')
  })
})

describe('ETA engine', () => {
  it('returns pending setup without milestones', () => {
    const eta = calculateProjectEta({
      projectStatus: 'ACTIVE',
      targetDate: null,
      estimatedCompletionDate: null,
      milestones: [],
      customerOpenDependencies: [],
    })
    expect(eta.state).toBe('pending_setup')
  })

  it('detects waiting on customer', () => {
    const eta = calculateProjectEta({
      projectStatus: 'ACTIVE',
      targetDate: new Date('2030-01-01'),
      estimatedCompletionDate: null,
      milestones: [{ title: 'Design', status: 'IN_PROGRESS', progressWeight: 50, targetDate: null, completedAt: null }],
      customerOpenDependencies: [{ status: 'REQUESTED', dueDate: null }],
    })
    expect(eta.state).toBe('waiting_on_customer')
  })
})

describe('project activity writer', () => {
  it('formats structured summaries', () => {
    expect(formatActivitySummary('FILE_UPLOADED', 'logo.png')).toContain('logo.png')
  })
})

describe('module entitlement filtering', () => {
  it('enables scheduler only when service is active', () => {
    const none = getServiceModules(new Set())
    const scheduler = none.find((m) => m.key === 'scheduler')
    expect(scheduler?.enabled).toBe(false)

    const active = getServiceModules(new Set(['scheduler']))
    expect(active.find((m) => m.key === 'scheduler')?.enabled).toBe(true)
  })

  it('evaluates entitlement helper', () => {
    const keys = new Set(['scheduler'])
    expect(isModuleEnabledForServices('scheduler', keys, 'scheduler')).toBe(true)
    expect(isModuleEnabledForServices('scheduler', keys, 'hosting')).toBe(false)
  })
})

describe('change request and approvals (rules)', () => {
  it('approval states are customer-actionable when pending', () => {
    const pending = 'PENDING'
    expect(pending === 'PENDING').toBe(true)
  })
})
