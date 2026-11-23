import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildSocialConnectionsAuthorizationContract } from '@/lib/platform/social/connections-authorization-contract'
import { assertSocialCampaignApprover } from '@/lib/platform/social/operator-auth-prisma'
import { assertSocialCampaignTransition } from '@/lib/platform/social/transitions'

describe('Batch 12 social HTTP integration', () => {
  it('maps social approval states for owners and denies members', () => {
    const owner = assertSocialCampaignApprover({
      userId: 'user_owner',
      customerAccountId: 'acct_1',
      membershipRole: 'OWNER',
      platformRole: 'CUSTOMER',
    })
    expect(owner.ok).toBe(true)
    const member = assertSocialCampaignApprover({
      userId: 'user_member',
      customerAccountId: 'acct_1',
      membershipRole: 'MEMBER',
      platformRole: 'CUSTOMER',
    })
    expect(member.ok).toBe(false)
    if (!member.ok) expect(member.code).toBe('UNAUTHORIZED_APPROVER')
  })

  it('exposes connection authorization contract without OAuth connect', () => {
    const contract = buildSocialConnectionsAuthorizationContract([
      {
        id: 'conn_1',
        customerAccountId: 'acct_1',
        managedSiteId: null,
        workspaceMappingId: 'map_1',
        providerKey: 'postiz',
        platform: 'instagram',
        externalChannelRef: 'ext_1',
        displayName: 'IG',
        connectionState: 'CONNECTED',
        permissions: null,
        secretRef: null,
        lastVerifiedAt: null,
        revokedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    expect(contract.oauthConnectEnabled).toBe(false)
    expect(contract.rows[0]?.dispatchAllowed).toBe(false)
    expect(contract.providerReadinessPath).toBe('/api/v1/social/provider-readiness')
  })

  it('enforces campaign transition to AWAITING_APPROVAL from DRAFT', () => {
    const gate = assertSocialCampaignTransition('DRAFT', 'AWAITING_APPROVAL')
    expect(gate.ok).toBe(true)
  })

  it('ships Prisma-backed approve route and marketing social-handoff HTTP', () => {
    const approve = readFileSync(
      join(process.cwd(), 'app/api/v1/social/campaigns/[id]/approve/route.ts'),
      'utf8',
    )
    expect(approve).toContain('submitSocialCampaignApprovalPersist')
    expect(approve).toContain('decideSocialCampaignApprovalPersist')

    const handoff = readFileSync(
      join(process.cwd(), 'app/api/v1/marketing/artifacts/[id]/social-handoff/route.ts'),
      'utf8',
    )
    expect(handoff).toContain('prepareApprovedCreativeSocialHandoff')

    const calendar = readFileSync(join(process.cwd(), 'app/api/v1/social/calendar/route.ts'), 'utf8')
    expect(calendar).toContain('valid ISO dates')
  })
})