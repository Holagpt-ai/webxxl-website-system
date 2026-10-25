import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    siteAnalyticsConnection: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

import { handleAnalyticsSyncWorkerRequest } from '@/lib/platform/analytics/ingestion/sync-worker-handler'

describe('BATCH-15.1 analytics release safety', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sync worker returns 503 when ingestion disabled', async () => {
    vi.stubEnv('ANALYTICS_INGESTION_ENABLED', '0')
    const res = await handleAnalyticsSyncWorkerRequest(new Headers())
    expect(res.status).toBe(503)
  })

  it('sync worker rejects missing worker secret', async () => {
    vi.stubEnv('ANALYTICS_INGESTION_ENABLED', '1')
    vi.stubEnv('AUTOMATION_WORKER_SECRET', 'worker-secret')
    const res = await handleAnalyticsSyncWorkerRequest(new Headers())
    expect(res.status).toBe(401)
  })

  it('sync worker accepts authorized caller when enabled', async () => {
    vi.stubEnv('ANALYTICS_INGESTION_ENABLED', '1')
    vi.stubEnv('AUTOMATION_WORKER_SECRET', 'worker-secret')
    const headers = new Headers({ 'x-automation-worker-secret': 'worker-secret' })
    const res = await handleAnalyticsSyncWorkerRequest(headers)
    expect(res.status).toBe(200)
    if (res.status === 200) expect(res.body.ok).toBe(true)
  })
})
