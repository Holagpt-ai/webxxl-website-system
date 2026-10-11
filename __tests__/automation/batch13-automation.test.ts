import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computeBackoffSeconds, classifyDeliveryError } from '@/lib/automation/errors'
import { buildAutomationEmail } from '@/lib/automation/templates/email'
import { RENEWAL_REMINDER_WINDOWS_DAYS } from '@/lib/automation/renewals'
import { verifyAutomationWorkerRequest } from '@/lib/automation/worker-auth'
import { isEnabled } from '@/config/features'
import { getDictionary } from '@/lib/i18n/dictionaries'

const hoisted = vi.hoisted(() => ({
  eventCreate: vi.fn(),
  eventFindUnique: vi.fn(),
  jobCreateMany: vi.fn(),
  jobFindMany: vi.fn(),
  jobUpdate: vi.fn(),
  userFindMany: vi.fn(),
  membershipFindMany: vi.fn(),
  preferenceUpsert: vi.fn(),
  notificationCreate: vi.fn(),
  renewalFindUnique: vi.fn(),
  renewalCreate: vi.fn(),
  domainFindMany: vi.fn(),
  hostingFindMany: vi.fn(),
  emailFindMany: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/db', () => ({
  prisma: {
    automationEvent: {
      create: hoisted.eventCreate,
      findUnique: hoisted.eventFindUnique,
    },
    automationDeliveryJob: {
      createMany: hoisted.jobCreateMany,
      findMany: hoisted.jobFindMany,
      update: hoisted.jobUpdate,
      findUnique: vi.fn(),
    },
    user: { findMany: hoisted.userFindMany },
    customerMembership: { findMany: hoisted.membershipFindMany },
    customerNotificationPreference: { upsert: hoisted.preferenceUpsert },
    notification: { create: hoisted.notificationCreate, updateMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    managedDomain: { findMany: hoisted.domainFindMany },
    hostingService: { findMany: hoisted.hostingFindMany },
    businessEmailService: { findMany: hoisted.emailFindMany },
    infrastructureRenewalReminder: {
      findUnique: hoisted.renewalFindUnique,
      create: hoisted.renewalCreate,
    },
  },
}))

vi.mock('@/lib/integrations/email', () => ({
  sendEmail: vi.fn(async () => ({ ok: true, id: 'email-1' })),
}))

import { emitAutomationEvent } from '@/lib/automation/dispatch'
import { evaluateInfrastructureRenewalReminders } from '@/lib/automation/renewals'
import { isChannelAllowedByPreference } from '@/lib/automation/preferences'

describe('batch13 feature flags and templates', () => {
  it('enables automation notifications foundation', () => {
    expect(isEnabled('automationNotifications')).toBe(true)
    expect(isEnabled('automationSmsChannel')).toBe(false)
  })

  it('builds EN/ES transactional email templates', () => {
    const en = buildAutomationEmail({ locale: 'en', title: 'Test', body: 'Hello' })
    const es = buildAutomationEmail({ locale: 'es', title: 'Prueba', body: 'Hola' })
    expect(en.subject).toBe('Test')
    expect(es.text).toContain('transaccional')
    expect(getDictionary('en').dashboard.notificationsTitle).toBe('Notifications')
  })
})

describe('batch13 dispatch deduplication', () => {
  beforeEach(() => {
    hoisted.eventCreate.mockReset()
    hoisted.eventFindUnique.mockReset()
    hoisted.jobCreateMany.mockReset()
    hoisted.userFindMany.mockResolvedValue([{ id: 'staff-1', email: 'staff@example.com' }])
    hoisted.jobFindMany.mockResolvedValue([])
  })

  it('deduplicates events by dedupeKey', async () => {
    hoisted.eventCreate.mockRejectedValue({ code: 'P2002' })
    hoisted.eventFindUnique.mockResolvedValue({ id: 'evt-1' })
    const result = await emitAutomationEvent({
      eventType: 'LEAD_RECEIVED',
      dedupeKey: 'lead.received:abc',
      payload: { title: 'Lead', body: 'New' },
    })
    expect(result.duplicate).toBe(true)
    expect(hoisted.jobCreateMany).not.toHaveBeenCalled()
  })

  it('persists event and plans delivery jobs', async () => {
    hoisted.eventCreate.mockResolvedValue({
      id: 'evt-2',
      eventType: 'SERVICE_ORDER_REQUESTED',
      dedupeKey: 'order:1',
      customerAccountId: 'acct-1',
      payload: { audience: 'customer_members', title: 'Order', body: 'Requested' },
    })
    hoisted.membershipFindMany.mockResolvedValue([{ user: { id: 'u1', email: 'u1@example.com' } }])
    hoisted.preferenceUpsert.mockResolvedValue({
      projectUpdates: true,
      messagesAndApprovals: true,
      serviceOrders: true,
      infrastructureRenewals: true,
      transactionalEmail: true,
    })
    hoisted.jobCreateMany.mockResolvedValue({ count: 2 })
    const result = await emitAutomationEvent({
      eventType: 'SERVICE_ORDER_REQUESTED',
      dedupeKey: 'order:1',
      customerAccountId: 'acct-1',
      payload: { audience: 'customer_members', title: 'Order', body: 'Requested' },
    })
    expect(result.ok).toBe(true)
    expect(hoisted.jobCreateMany).toHaveBeenCalled()
  })
})

describe('batch13 preferences and backoff', () => {
  it('respects customer opt-out categories', () => {
    const allowed = isChannelAllowedByPreference(
      {
        id: 'p1',
        userId: 'u1',
        customerAccountId: 'a1',
        projectUpdates: false,
        messagesAndApprovals: true,
        serviceOrders: true,
        infrastructureRenewals: true,
        transactionalEmail: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      'projectUpdates',
      'IN_APP',
    )
    expect(allowed).toBe(false)
  })

  it('applies exponential backoff caps', () => {
    expect(computeBackoffSeconds(1)).toBe(60)
    expect(computeBackoffSeconds(5)).toBeLessThanOrEqual(3600)
    expect(classifyDeliveryError(new Error('provider timeout'))).toBe('provider_timeout')
  })
})

describe('batch13 renewal reminders', () => {
  beforeEach(() => {
    hoisted.domainFindMany.mockResolvedValue([])
    hoisted.hostingFindMany.mockResolvedValue([])
    hoisted.emailFindMany.mockResolvedValue([])
    hoisted.renewalFindUnique.mockResolvedValue(null)
    hoisted.renewalCreate.mockResolvedValue({})
    hoisted.eventCreate.mockResolvedValue({
      id: 'evt-r',
      eventType: 'DOMAIN_RENEWAL_APPROACHING',
      dedupeKey: 'renewal:DOMAIN:d1:30',
      customerAccountId: 'acct-1',
      payload: {},
    })
    hoisted.jobCreateMany.mockResolvedValue({ count: 1 })
    hoisted.userFindMany.mockResolvedValue([{ id: 'staff-1', email: 's@x.com' }])
    hoisted.jobFindMany.mockResolvedValue([])
  })

  it('uses configured reminder windows', () => {
    expect(RENEWAL_REMINDER_WINDOWS_DAYS).toEqual([30, 14, 7])
  })

  it('skips duplicate renewal reminders', async () => {
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    hoisted.domainFindMany.mockResolvedValue([
      { id: 'd1', customerAccountId: 'acct-1', expiresAt: in30Days, domainName: 'example.com', publicId: 'MD-1' },
    ])
    hoisted.renewalFindUnique.mockResolvedValue({ id: 'sent' })
    const result = await evaluateInfrastructureRenewalReminders()
    expect(result.eventsCreated).toBe(0)
    expect(hoisted.renewalCreate).not.toHaveBeenCalled()
  })
})

describe('batch13 worker authentication', () => {
  it('rejects missing worker secret', () => {
    const headers = new Headers()
    expect(verifyAutomationWorkerRequest(headers)).toBe(false)
  })
})
