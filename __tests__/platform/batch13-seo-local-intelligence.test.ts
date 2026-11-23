import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildSeoConnectionsAuthorizationContract } from '@/lib/platform/seo/connections-authorization-contract'
import { buildModuleHandoff } from '@/lib/platform/customer-dashboard/module-handoffs'
import { LOCAL_SEO_WORKSPACES } from '@/lib/platform/seo/local-seo-workspaces'

describe('Batch 13 SEO local intelligence HTTP', () => {
  it('defines Google OAuth handoff contract without live OAuth start', () => {
    const src = readFileSync(
      join(process.cwd(), 'lib/platform/google/oauth-handoff-contract.ts'),
      'utf8',
    )
    expect(src).toContain('oauthConnectionEnabled: false')
    expect(src).toContain('oauthStartAvailable: false')
  })

  it('wraps SEO connections with authorization contract', () => {
    const contract = buildSeoConnectionsAuthorizationContract('site_a', [
      {
        id: 'conn_1',
        provider: 'GSC',
        verificationState: 'VERIFIED',
        dataState: 'READY',
        revokedAt: null,
      },
    ])
    expect(contract.oauthConnectEnabled).toBe(false)
    expect(contract.oauthHandoffPath).toContain('/google/oauth-handoff')
    expect(contract.rows[0]?.dispatchAllowed).toBe(false)
  })

  it('extends local SEO dashboard module handoffs without duplicating site intelligence', () => {
    const handoff = buildModuleHandoff(
      'local_seo',
      { state: 'available', empty: true, sourceCheckedAt: new Date().toISOString(), evidenceCount: 0 },
      { managedSiteId: 'site_xyz' },
    )
    expect(handoff.apis.some((row) => row.path.includes('keywords/intelligence'))).toBe(true)
    expect(handoff.apis.some((row) => row.path.includes('site_xyz'))).toBe(true)
    expect(LOCAL_SEO_WORKSPACES.keywords).toBe('/dashboard/seo/keywords')
  })

  it('ships crawl, keyword intelligence, competitor detail, and oauth handoff routes', () => {
    const paths = [
      'app/api/v1/seo/sites/[siteId]/keywords/intelligence/route.ts',
      'app/api/v1/seo/sites/[siteId]/crawl-runs/route.ts',
      'app/api/v1/seo/sites/[siteId]/crawl-runs/[runId]/route.ts',
      'app/api/v1/seo/sites/[siteId]/competitors/[competitorId]/route.ts',
      'app/api/v1/seo/sites/[siteId]/google/oauth-handoff/route.ts',
    ]
    for (const rel of paths) {
      const src = readFileSync(join(process.cwd(), rel), 'utf8')
      expect(src).toContain('requireSeoApiActor')
      expect(src).toContain('seoRouteError')
    }
  })
})