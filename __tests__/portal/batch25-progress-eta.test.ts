import { describe, expect, it } from 'vitest'
import { calculateProjectProgress } from '@/lib/portal/progress'
import { calculateProjectEta } from '@/lib/portal/eta'
import { formatDeliveryForecast } from '@/lib/portal/delivery-display'

describe('calculateProjectProgress', () => {
  it('normalizes weights that do not sum to 100', () => {
    const progress = calculateProjectProgress([
      { id: 'a', title: 'A', status: 'COMPLETED', progressWeight: 10 },
      { id: 'b', title: 'B', status: 'COMPLETED', progressWeight: 20 },
      { id: 'c', title: 'C', status: 'IN_PROGRESS', progressWeight: 70 },
    ])
    expect(progress).toBe(30)
  })

  it('ignores duplicate milestone ids', () => {
    const progress = calculateProjectProgress([
      { id: 'dup', title: 'One', status: 'COMPLETED', progressWeight: 50 },
      { id: 'dup', title: 'Dup', status: 'COMPLETED', progressWeight: 50 },
    ])
    expect(progress).toBe(100)
  })

  it('returns 0 when there are no milestones', () => {
    expect(calculateProjectProgress([])).toBe(0)
  })
})

describe('calculateProjectEta forecast', () => {
  it('does not treat target date as forecast when no estimate is recorded', () => {
    const target = new Date('2030-06-01T00:00:00Z')
    const eta = calculateProjectEta({
      projectStatus: 'ACTIVE',
      targetDate: target,
      estimatedCompletionDate: null,
      milestones: [{ id: 'm1', title: 'M1', status: 'IN_PROGRESS', progressWeight: 100, targetDate: null, completedAt: null }],
      customerOpenDependencies: [],
    })
    expect(eta.forecastDate).toBeNull()
    expect(eta.targetDate).toEqual(target)
    const formatted = formatDeliveryForecast(eta, 'en', {
      etaUnavailable: 'Estimated completion date not yet available.',
      targetDateLabel: 'Target',
    })
    expect(formatted.forecast).toBe('Estimated completion date not yet available.')
  })

  it('keeps ABMED-style progress at 45% with open customer dependencies', () => {
    const eta = calculateProjectEta({
      projectStatus: 'ACTIVE',
      targetDate: null,
      estimatedCompletionDate: null,
      milestones: [
        { id: '1', title: 'M1', status: 'COMPLETED', progressWeight: 10, targetDate: null, completedAt: null },
        { id: '2', title: 'M2', status: 'COMPLETED', progressWeight: 20, targetDate: null, completedAt: null },
        { id: '3', title: 'M3', status: 'COMPLETED', progressWeight: 15, targetDate: null, completedAt: null },
        { id: '4', title: 'M4', status: 'IN_PROGRESS', progressWeight: 20, targetDate: null, completedAt: null },
        { id: '5', title: 'M5', status: 'PENDING', progressWeight: 15, targetDate: null, completedAt: null },
        { id: '6', title: 'M6', status: 'PENDING', progressWeight: 10, targetDate: null, completedAt: null },
        { id: '7', title: 'M7', status: 'PENDING', progressWeight: 5, targetDate: null, completedAt: null },
        { id: '8', title: 'M8', status: 'PENDING', progressWeight: 5, targetDate: null, completedAt: null },
      ],
      customerOpenDependencies: [{ status: 'REQUESTED', dueDate: null }],
    })
    expect(eta.progressPercent).toBe(45)
    expect(eta.state).toBe('waiting_on_customer')
  })
})
