import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { customerNotificationWhere } from '@/lib/portal/notification-scope'
import { verifyAutomationWorkerRequest } from '@/lib/automation/worker-auth'
import { isEnabled } from '@/config/features'
import { getDnsProvider, getHostingProvider } from '@/lib/infrastructure/providers/stubs'
import { SUPABASE_HARDENING_NOTES } from '@/lib/security/supabase-hardening'
import { parseMagicLinkEmailContext } from '@/lib/integrations/email'

describe('batch15 supabase hardening migration', () => {
  it('ships idempotent revoke migration for anon/authenticated', () => {
    const sql = readFileSync(
      join(process.cwd(), 'prisma/migrations/20261011200000_restrict_supabase_api_access/migration.sql'),
      'utf8',
    )
    expect(sql).toContain('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated')
    expect(sql).not.toContain('ENABLE ROW LEVEL SECURITY')
    expect(SUPABASE_HARDENING_NOTES.accessPattern).toContain('Prisma')
  })
})

describe('batch15 customer notification tenant scope', () => {
  it('scopes notifications to active customer account', () => {
    const where = customerNotificationWhere('user-1', 'acct-a')
    expect(where).toEqual({
      userId: 'user-1',
      OR: [{ customerAccountId: 'acct-a' }, { customerAccountId: null }],
    })
  })
})

describe('batch15 automation worker auth', () => {
  it('rejects requests when secret is not configured', () => {
    vi.stubEnv('AUTOMATION_WORKER_SECRET', '')
    const headers = new Headers({ 'x-automation-worker-secret': 'anything' })
    expect(verifyAutomationWorkerRequest(headers)).toBe(false)
    vi.unstubAllEnvs()
  })

  it('accepts matching secret with timing-safe compare', () => {
    vi.stubEnv('AUTOMATION_WORKER_SECRET', 'test-secret-value')
    const headers = new Headers({ 'x-automation-worker-secret': 'test-secret-value' })
    expect(verifyAutomationWorkerRequest(headers)).toBe(true)
    vi.unstubAllEnvs()
  })
})

describe('batch15 automation safety flags', () => {
  it('keeps optional channels disabled', () => {
    expect(isEnabled('automationSmsChannel')).toBe(false)
    expect(isEnabled('automationWhatsappChannel')).toBe(false)
    expect(isEnabled('automationPushChannel')).toBe(false)
  })

  it('blocks infrastructure provider writes', async () => {
    const hosting = getHostingProvider('x')
    const dns = getDnsProvider('x')
    await expect(hosting.requestProvisioning()).resolves.toEqual({ ok: false, error: 'unavailable' })
    await expect(dns.requestModification()).resolves.toEqual({ ok: false, error: 'unavailable' })
  })
})

describe('batch15 auth locale routing helpers', () => {
  it('parses ES invitation callback URLs', () => {
    const url = 'https://www.example.com/api/auth/callback/email?callbackUrl=https%3A%2F%2Fwww.example.com%2Fapi%2Fportal%2Factivate-account%3Flocale%3Des'
    const ctx = parseMagicLinkEmailContext(url)
    expect(ctx.locale).toBe('es')
    expect(ctx.kind).toBe('invitation')
  })
})
