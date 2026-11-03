import type { PrismaClient } from '@prisma/client'
import { stagingPilotFixturePayloadSpec } from '@/lib/platform/pilot/staging-pilot-fixture-payloads'
import type { StagingPilotFixtureApplyReport } from '@/lib/platform/pilot/staging-pilot-fixture-reconcile'
import type { StagingPilotFixtureState } from '@/lib/platform/pilot/staging-pilot-fixture-inspect'

export type StagingPilotFixtureExecuteResult = {
  applied: number
  skipped: number
  blocked: number
}

/** Apply only create actions when report.readyForApply is true. Non-destructive upserts only. */
export async function executeStagingPilotFixtureApply(
  prisma: PrismaClient,
  report: StagingPilotFixtureApplyReport,
  state: StagingPilotFixtureState,
): Promise<StagingPilotFixtureExecuteResult> {
  if (!report.readyForApply) {
    return { applied: 0, skipped: report.actions.length, blocked: report.conflicts.length }
  }

  const payload = stagingPilotFixturePayloadSpec()
  const productId = state.catalog.websiteSubscriptionProduct.productId!
  const productPriceId = state.catalog.websiteSubscriptionProduct.priceId!
  const now = new Date('2026-11-03T12:00:00.000Z')

  let applied = 0

  await prisma.$transaction(async (tx) => {
    for (const group of payload.billingGroups) {
      if (state.billingGroups[group.id]?.present) continue
      await tx.billingGroup.create({
        data: {
          id: group.id,
          name: group.name,
          slug: group.slug,
          status: 'ACTIVE',
        },
      })
      applied += 1
    }

    for (const account of payload.customerAccounts) {
      if (state.customerAccounts[account.id]?.present) continue
      await tx.customerAccount.create({
        data: {
          id: account.id,
          businessName: account.businessName,
          slug: account.slug,
          status: 'ACTIVE',
          locale: account.id === payload.customerAccounts[0]!.id ? 'en' : 'es',
        },
      })
      applied += 1
    }

    for (const user of payload.users) {
      if (state.users[user.id]?.present) continue
      await tx.user.create({
        data: {
          id: user.id,
          email: user.email,
          name: user.id.includes('_a') ? 'Pilot Staging A' : 'Pilot Staging B',
          preferredLocale: user.preferredLocale,
          role: 'CUSTOMER',
        },
      })
      applied += 1
    }

    for (const link of payload.billingGroupMemberships) {
      if (state.billingGroupMemberships[link.customerAccountId]?.present) continue
      await tx.billingGroupMembership.create({
        data: {
          id: link.id,
          billingGroupId: link.billingGroupId,
          customerAccountId: link.customerAccountId,
          status: 'ACTIVE',
          validFrom: now,
          activeFundingKey: link.customerAccountId,
          walletUseAllowed: true,
        },
      })
      applied += 1
    }

    for (const membership of payload.customerMemberships) {
      const key = `${membership.userId}:${membership.customerAccountId}`
      if (state.customerMemberships[key]?.present) continue
      await tx.customerMembership.create({
        data: {
          userId: membership.userId,
          customerAccountId: membership.customerAccountId,
          role: membership.role,
        },
      })
      applied += 1
    }

    const subSnap = state.subscriptions[payload.subscription.publicId]
    if (!subSnap?.present) {
      await tx.commerceSubscription.create({
        data: {
          publicId: payload.subscription.publicId,
          billingGroupId: payload.subscription.billingGroupId,
          customerAccountId: payload.subscription.customerAccountId,
          productId,
          productPriceId,
          providerKey: payload.subscription.providerKey,
          externalSubscriptionRef: `pilot-staging-${payload.subscription.publicId}`,
          status: 'ACTIVE',
          billingInterval: 'MONTH',
          currentPeriodStart: now,
          currentPeriodEnd: new Date('2026-12-03T12:00:00.000Z'),
        },
      })
      applied += 1
    }
  })

  return {
    applied,
    skipped: report.actions.filter((a) => a.kind === 'noop').length,
    blocked: report.actions.filter((a) => a.kind === 'blocked').length,
  }
}
