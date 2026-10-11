import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  persistSalesLead: vi.fn(),
  recordNewsletterSubscriber: vi.fn(),
  logLeadPersistenceFailure: vi.fn(),
  logNewsletterPersistenceFailure: vi.fn(),
}))

vi.mock('@/lib/leads/intake', () => ({
  persistSalesLead: hoisted.persistSalesLead,
  recordNewsletterSubscriber: hoisted.recordNewsletterSubscriber,
}))

vi.mock('@/lib/leads/persistence-log', () => ({
  logLeadPersistenceFailure: hoisted.logLeadPersistenceFailure,
  logNewsletterPersistenceFailure: hoisted.logNewsletterPersistenceFailure,
}))

import { submitContact, submitLead } from '@/lib/integrations/forms'

describe('forms lead persistence failure handling', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ id: 'resend-msg-abc12345' }),
      })),
    )
    process.env.RESEND_API_KEY = 'test-key'
    hoisted.persistSalesLead.mockReset()
    hoisted.recordNewsletterSubscriber.mockReset()
    hoisted.logLeadPersistenceFailure.mockReset()
    hoisted.logNewsletterPersistenceFailure.mockReset()
  })

  it('returns email confirmation when CRM persistence fails after Resend succeeds', async () => {
    hoisted.persistSalesLead.mockRejectedValueOnce(new Error('db unavailable'))
    const result = await submitContact({
      name: 'Alex',
      email: 'alex@example.com',
      message: 'Need a website',
      locale: 'en',
    })
    expect(result).toMatchObject({ ok: true, persistedToCrm: false })
    expect(result.ok && result.reference).toMatch(/^MSG-/)
    expect(hoisted.logLeadPersistenceFailure).toHaveBeenCalledWith({
      source: 'CONTACT',
      resendMessageId: 'resend-msg-abc12345',
    })
  })

  it('still confirms newsletter signup when subscriber persistence fails', async () => {
    hoisted.recordNewsletterSubscriber.mockRejectedValueOnce(new Error('db unavailable'))
    const result = await submitLead({ email: 'reader@example.com', source: 'footer', locale: 'es' })
    expect(result).toMatchObject({ ok: true, persistedToCrm: false })
    expect(hoisted.logNewsletterPersistenceFailure).toHaveBeenCalled()
  })
})
