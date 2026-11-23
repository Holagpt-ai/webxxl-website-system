import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCommsConnectionsAuthorizationContract } from '@/lib/platform/comms/connections-authorization-contract'
import { buildModuleHandoff } from '@/lib/platform/customer-dashboard/module-handoffs'
import { validateAnalyticsMetricParam } from '@/lib/platform/analytics/measurements-read-service'
import { COMMUNICATIONS_WORKSPACES } from '@/lib/platform/comms/comms-workspaces'
import { ANALYTICS_WORKSPACES } from '@/lib/platform/analytics/analytics-workspaces'

describe('Batch 14 communications and analytics HTTP', () => {
  it('maps AuthError to stable unauthorized envelope in comms http helper', () => {
    const src = readFileSync(join(process.cwd(), 'lib/platform/comms/http.ts'), 'utf8')
    expect(src).toContain('AuthError')
    expect(src).toContain("code: 'UNAUTHORIZED'")
  })

  it('extends communications connections with authorization contract', () => {
    const contract = buildCommsConnectionsAuthorizationContract({
      chatwoot: {
        configured: false,
        authorizedInboxCount: 0,
        verifiedInboxCount: 0,
        disconnected: true,
        mappingPending: false,
        staleSyncRisk: false,
        dataState: 'NOT_CONNECTED',
        summary: 'Not configured',
      },
      inboxes: [],
    })
    expect(contract.oauthConnectEnabled).toBe(false)
    expect(contract.dispatchAllowed).toBe(false)
    expect(contract.providerReadinessPath).toBe('/api/v1/communications/provider-readiness')
  })

  it('fixes dashboard communications APIs to /api/v1/communications paths', () => {
    const handoff = buildModuleHandoff(
      'communications',
      { state: 'available', empty: false, sourceCheckedAt: new Date().toISOString(), evidenceCount: 0 },
    )
    expect(handoff.apis.every((row) => row.path.startsWith('/api/v1/communications/'))).toBe(true)
    expect(handoff.apis.some((row) => row.path.includes('/comms/'))).toBe(false)
  })

  it('scopes analytics dashboard handoffs to the session account id', () => {
    const handoff = buildModuleHandoff(
      'analytics',
      { state: 'available', empty: false, sourceCheckedAt: new Date().toISOString(), evidenceCount: 0 },
      { customerAccountId: 'acct_batch14', managedSiteId: 'site_1' },
    )
    expect(handoff.apis.some((row) => row.path.includes('acct_batch14'))).toBe(true)
    expect(handoff.apis.some((row) => row.path.includes('measurements'))).toBe(true)
    expect(handoff.workspace.path).toContain('site=site_1')
  })

  it('validates analytics measurement drill-down metric param', () => {
    expect(validateAnalyticsMetricParam('ga4.sessions').ok).toBe(true)
    expect(validateAnalyticsMetricParam('').ok).toBe(false)
    expect(validateAnalyticsMetricParam('bad metric!').ok).toBe(false)
  })

  it('ships batch 14 customer routes for comms and analytics drill-down', () => {
    const paths = [
      'app/api/v1/communications/inboxes/[inboxId]/route.ts',
      'app/api/v1/communications/contacts/[contactId]/handoff/route.ts',
      'app/api/v1/analytics/accounts/[accountId]/measurements/route.ts',
      'app/api/v1/analytics/accounts/[accountId]/conversions/[conversionKey]/route.ts',
      'app/api/v1/marketing/follow-ups/[id]/prepare-outreach/route.ts',
    ]
    for (const rel of paths) {
      expect(readFileSync(join(process.cwd(), rel), 'utf8').length).toBeGreaterThan(20)
    }
  })

  it('exposes communications and analytics workspace cross-module links', () => {
    expect(COMMUNICATIONS_WORKSPACES.connections).toBe('/dashboard/communications/connections')
    expect(ANALYTICS_WORKSPACES.conversions).toContain('tab=conversions')
  })
})