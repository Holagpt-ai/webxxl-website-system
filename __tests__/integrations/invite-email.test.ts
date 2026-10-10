import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())

describe('invitation email copy', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    process.env.RESEND_API_KEY = 'test-key'
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 'email-1' }) })
  })

  it('sends English invitation copy', async () => {
    const { sendMagicLinkEmail } = await import('@/lib/integrations/email')
    await sendMagicLinkEmail('user@example.com', 'https://example.com/link', { kind: 'invitation', locale: 'en' })
    expect(fetchMock).toHaveBeenCalled()
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(body.subject).toContain('Invitation')
    expect(body.text).toContain("You've been invited")
  })

  it('sends Spanish invitation copy', async () => {
    const { sendMagicLinkEmail } = await import('@/lib/integrations/email')
    await sendMagicLinkEmail('user@example.com', 'https://example.com/link', { kind: 'invitation', locale: 'es' })
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(body.subject).toContain('Invitación')
    expect(body.text).toContain('Has sido invitado')
  })
})
