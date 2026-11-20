import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireStaff: vi.fn(),
  evaluate: vi.fn(),
}))

vi.mock('@/lib/portal/authz', () => ({
  AuthError: class AuthError extends Error {
    constructor(message = 'Unauthorized') {
      super(message)
      this.name = 'AuthError'
    }
  },
  requireStaff: mocks.requireStaff,
}))

vi.mock('@/lib/platform/admin-operations/runtime-database-verification', () => ({
  evaluateRuntimeDatabaseVerification: mocks.evaluate,
}))

import { AuthError } from '@/lib/portal/authz'
import { GET } from '@/app/api/v1/admin/operations/database-verification/route'

describe('GET /api/v1/admin/operations/database-verification', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.requireStaff.mockResolvedValue({ id: 'staff-1', role: 'STAFF' })
  })

  it('returns 401 for unauthorized callers', async () => {
    mocks.requireStaff.mockRejectedValueOnce(new AuthError())
    const response = await GET()
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ code: 'UNAUTHORIZED' })
    expect(mocks.evaluate).not.toHaveBeenCalled()
  })

  it('returns 200 with verdict payload for staff without leaking URLs', async () => {
    mocks.evaluate.mockResolvedValueOnce({
      verdict: 'VERIFIED_PRODUCTION',
      configuration: { urlsConfigured: true, urlsAligned: true },
      connectivity: { databaseUrl: 'OK', directUrl: 'OK', migrationLedgerFinished: 40 },
    })

    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.verdict).toBe('VERIFIED_PRODUCTION')
    expect(JSON.stringify(body)).not.toMatch(/txfx|vcgib|postgresql|supabase\.co/i)
  })
})