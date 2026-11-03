import type { PrismaClient } from '@prisma/client'
import { STAGING_PILOT_SAFEGUARDS_VERSION } from '@/lib/platform/pilot/staging-pilot-fixture-ids'
import {
  STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID,
  STAGING_PILOT_NON_SUBSCRIBER_USER_ID,
  STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID,
  STAGING_PILOT_SUBSCRIBER_USER_ID,
} from '@/lib/platform/pilot/staging-pilot-fixture-ids'
import {
  stagingPilotFixturePayloadSpec,
  STAGING_PILOT_NON_SUBSCRIBER_EMAIL,
  STAGING_PILOT_SUBSCRIBER_EMAIL,
} from '@/lib/platform/pilot/staging-pilot-fixture-payloads'

export type StagingPilotFixtureCollisionReport = {
  safeguardsVersion: typeof STAGING_PILOT_SAFEGUARDS_VERSION
  conflicts: string[]
}

/**
 * Read-only collision preflight (PILOT-42-PRE-001).
 * Detects slug/email ownership clashes and cross-tenant membership links without mutating data.
 */
export async function detectStagingPilotFixtureCollisions(
  prisma: PrismaClient,
): Promise<StagingPilotFixtureCollisionReport> {
  const payload = stagingPilotFixturePayloadSpec()
  const accountSlugs = payload.customerAccounts.map((a) => a.slug)
  const groupSlugs = payload.billingGroups.map((g) => g.slug)
  const emails = payload.users.map((u) => u.email)
  const pilotUserIds = payload.users.map((u) => u.id)
  const pilotAccountIds = payload.customerAccounts.map((a) => a.id)

  const [accountsBySlug, groupsBySlug, usersByEmail, crossMemberships, authByPilotEmail] =
    await Promise.all([
      prisma.customerAccount.findMany({ where: { slug: { in: accountSlugs } } }),
      prisma.billingGroup.findMany({ where: { slug: { in: groupSlugs } } }),
      prisma.user.findMany({ where: { email: { in: emails } } }),
      prisma.customerMembership.findMany({
        where: {
          OR: [
            {
              userId: STAGING_PILOT_SUBSCRIBER_USER_ID,
              customerAccountId: { not: STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID },
            },
            {
              userId: STAGING_PILOT_NON_SUBSCRIBER_USER_ID,
              customerAccountId: { not: STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID },
            },
            {
              customerAccountId: STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID,
              userId: { not: STAGING_PILOT_SUBSCRIBER_USER_ID },
            },
            {
              customerAccountId: STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID,
              userId: { not: STAGING_PILOT_NON_SUBSCRIBER_USER_ID },
            },
          ],
        },
        select: { userId: true, customerAccountId: true },
      }),
      prisma.account.findMany({
        where: { user: { email: { in: emails } } },
        select: {
          provider: true,
          userId: true,
          user: { select: { id: true, email: true } },
        },
      }),
    ])

  const conflicts: string[] = []

  for (const expected of payload.customerAccounts) {
    const owner = accountsBySlug.find((r) => r.slug === expected.slug)
    if (owner && owner.id !== expected.id) {
      conflicts.push(
        `CustomerAccount slug "${expected.slug}" is owned by ${owner.id}, not pilot id ${expected.id}`,
      )
    }
  }

  for (const expected of payload.billingGroups) {
    const owner = groupsBySlug.find((r) => r.slug === expected.slug)
    if (owner && owner.id !== expected.id) {
      conflicts.push(
        `BillingGroup slug "${expected.slug}" is owned by ${owner.id}, not pilot id ${expected.id}`,
      )
    }
  }

  for (const expected of payload.users) {
    const owner = usersByEmail.find((r) => r.email === expected.email)
    if (owner && owner.id !== expected.id) {
      conflicts.push(`User email ${expected.email} is owned by ${owner.id}, not pilot id ${expected.id}`)
    }
  }

  for (const row of crossMemberships) {
    conflicts.push(
      `Cross-tenant CustomerMembership user=${row.userId} account=${row.customerAccountId} blocks pilot isolation`,
    )
  }

  for (const link of authByPilotEmail) {
    const expectedUser = payload.users.find((u) => u.email === link.user.email)
    if (expectedUser && link.userId !== expectedUser.id) {
      conflicts.push(
        `Auth.js Account (provider=${link.provider}) is linked to user ${link.userId} for email ${link.user.email}, not pilot id ${expectedUser.id}`,
      )
    }
    if (
      link.userId === STAGING_PILOT_SUBSCRIBER_USER_ID &&
      link.user.email !== STAGING_PILOT_SUBSCRIBER_EMAIL
    ) {
      conflicts.push('Pilot user A Auth identity email mismatch')
    }
    if (
      link.userId === STAGING_PILOT_NON_SUBSCRIBER_USER_ID &&
      link.user.email !== STAGING_PILOT_NON_SUBSCRIBER_EMAIL
    ) {
      conflicts.push('Pilot user B Auth identity email mismatch')
    }
  }

  const pilotAccountsPresent = await prisma.customerAccount.findMany({
    where: { id: { in: pilotAccountIds } },
    select: { id: true, slug: true },
  })
  for (const expected of payload.customerAccounts) {
    const row = pilotAccountsPresent.find((r) => r.id === expected.id)
    if (row && row.slug !== expected.slug) {
      conflicts.push(`Pilot CustomerAccount ${expected.id} has slug ${row.slug}, expected ${expected.slug}`)
    }
  }

  const pilotUsersPresent = await prisma.user.findMany({
    where: { id: { in: pilotUserIds } },
    select: { id: true, email: true },
  })
  for (const expected of payload.users) {
    const row = pilotUsersPresent.find((r) => r.id === expected.id)
    if (row && row.email !== expected.email) {
      conflicts.push(`Pilot User ${expected.id} has email ${row.email}, expected ${expected.email}`)
    }
  }

  return { safeguardsVersion: STAGING_PILOT_SAFEGUARDS_VERSION, conflicts: [...new Set(conflicts)] }
}
