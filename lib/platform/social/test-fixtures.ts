import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_CLINICAL_ACCOUNT_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
} from '@/lib/platform/fixtures/abmed'
import { createSocialStore, nextSocialId, type SocialStore } from '@/lib/platform/social/in-memory-store'
import type { BusinessSocialConnectionRecord, SocialProviderWorkspaceMappingRecord } from '@/lib/platform/social/types'

export const STAFF_SOCIAL_APPROVER_ID = 'user_webxxl_social_approver'
export const UNRELATED_CUSTOMER_ACCOUNT_ID = 'acct_unrelated_customer'
export const UNRELATED_USER_ID = 'user_unrelated'

export function registerSyntheticSocialApprovers(store: SocialStore): void {
  store.trustedApprovers.set(STAFF_SOCIAL_APPROVER_ID, { platformWide: true })
}

export function trustedSocialStaffApprover() {
  return { kind: 'verified_human' as const, userId: STAFF_SOCIAL_APPROVER_ID, platformWide: true }
}

export function seedAbmedSocialConnections(store: SocialStore): void {
  const accounts = [
    { accountId: ABMED_AESTHETICS_ACCOUNT_ID, platform: 'instagram' as const, ref: 'postiz_int_aesthetics_ig' },
    { accountId: ABMED_PHYSICIANS_ACCOUNT_ID, platform: 'linkedin' as const, ref: 'postiz_int_physicians_li' },
    { accountId: ABMED_CLINICAL_ACCOUNT_ID, platform: 'facebook' as const, ref: 'postiz_int_clinical_fb' },
  ]
  for (const row of accounts) {
    const workspace: SocialProviderWorkspaceMappingRecord = {
      id: nextSocialId('socws'),
      customerAccountId: row.accountId,
      providerKey: 'postiz',
      externalWorkspaceRef: `workspace_${row.accountId}`,
      secretRef: `secret:${row.accountId}`,
      connectionState: 'CONNECTED',
      authorizedByUserId: STAFF_SOCIAL_APPROVER_ID,
      lastVerifiedAt: new Date('2026-10-01T00:00:00Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    store.workspaceMappings.set(workspace.id, workspace)
    const connection: BusinessSocialConnectionRecord = {
      id: nextSocialId('socconn'),
      customerAccountId: row.accountId,
      workspaceMappingId: workspace.id,
      providerKey: 'postiz',
      platform: row.platform,
      externalChannelRef: row.ref,
      displayName: `${row.platform}@${row.accountId}`,
      connectionState: 'CONNECTED',
      lastVerifiedAt: new Date('2026-10-01T00:00:00Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    store.connections.set(connection.id, connection)
  }
  store.billingGroupSiblingAccounts.set('group_abmed', [
    ABMED_AESTHETICS_ACCOUNT_ID,
    ABMED_PHYSICIANS_ACCOUNT_ID,
    ABMED_CLINICAL_ACCOUNT_ID,
  ])
  store.operatingMemberships.push(
    { userId: STAFF_SOCIAL_APPROVER_ID, customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID },
    { userId: STAFF_SOCIAL_APPROVER_ID, customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID },
    { userId: STAFF_SOCIAL_APPROVER_ID, customerAccountId: ABMED_CLINICAL_ACCOUNT_ID },
  )
  store.postizSecrets.set(`secret:${ABMED_AESTHETICS_ACCOUNT_ID}`, 'test-key-aesthetics')
}

export function createSocial04TestStore(): SocialStore {
  const store = createSocialStore()
  registerSyntheticSocialApprovers(store)
  seedAbmedSocialConnections(store)
  return store
}

/** Deterministic synthetic 30-day editorial plan (test-only, no LLM). */
export function buildSynthetic30DayEditorialPlan(store: SocialStore, customerAccountId: string, createdByUserId: string) {
  const themes = ['brand-awareness', 'patient-education', 'community-event']
  const platforms = ['instagram', 'linkedin', 'facebook'] as const
  const entries: { day: number; locale: 'en' | 'es'; theme: string; platform: (typeof platforms)[number] }[] = []
  for (let day = 1; day <= 30; day += 1) {
    entries.push({
      day,
      locale: day % 2 === 0 ? 'en' : 'es',
      theme: themes[day % themes.length]!,
      platform: platforms[day % platforms.length]!,
    })
  }
  return entries.map((entry, index) => ({
    idempotencyKey: `plan30:${customerAccountId}:${entry.day}`,
    goal: `${entry.theme} day ${entry.day}`,
    locale: entry.locale,
    platform: entry.platform,
    captionEn: `[EN] ${entry.theme} — day ${entry.day}`,
    captionEs: `[ES] ${entry.theme} — día ${entry.day}`,
    scheduledAt: new Date(Date.UTC(2026, 10, entry.day, 15, 0, 0)),
    createdByUserId,
    index,
  }))
}
