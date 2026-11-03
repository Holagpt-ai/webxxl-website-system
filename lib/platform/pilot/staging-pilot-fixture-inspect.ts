import type { PrismaClient } from '@prisma/client'
import { WEBSITE_SUBSCRIPTION_PRODUCT_KEY } from '@/lib/platform/open001/subscriber-evidence'
import {
  STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID,
  STAGING_PILOT_NON_SUBSCRIBER_BILLING_GROUP_ID,
  STAGING_PILOT_NON_SUBSCRIBER_USER_ID,
  STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID,
  STAGING_PILOT_SUBSCRIBER_BILLING_GROUP_ID,
  STAGING_PILOT_SUBSCRIBER_SUBSCRIPTION_PUBLIC_ID,
  STAGING_PILOT_SUBSCRIBER_USER_ID,
} from '@/lib/platform/pilot/staging-pilot-fixture-ids'
import { stagingPilotFixturePayloadSpec } from '@/lib/platform/pilot/staging-pilot-fixture-payloads'

export type StagingPilotFixtureEntitySnapshot = {
  present: boolean
  summary: string
  conflict?: string
}

export type StagingPilotFixtureCatalogSnapshot = {
  websiteSubscriptionProduct: StagingPilotFixtureEntitySnapshot & {
    productId?: string
    priceId?: string
  }
}

export type StagingPilotFixtureState = {
  billingGroups: Record<string, StagingPilotFixtureEntitySnapshot>
  customerAccounts: Record<string, StagingPilotFixtureEntitySnapshot>
  users: Record<string, StagingPilotFixtureEntitySnapshot>
  customerMemberships: Record<string, StagingPilotFixtureEntitySnapshot>
  billingGroupMemberships: Record<string, StagingPilotFixtureEntitySnapshot>
  subscriptions: Record<string, StagingPilotFixtureEntitySnapshot & { customerAccountId?: string | null }>
  catalog: StagingPilotFixtureCatalogSnapshot
}

function missing(id: string): StagingPilotFixtureEntitySnapshot {
  return { present: false, summary: `${id} not found` }
}

function present(summary: string): StagingPilotFixtureEntitySnapshot {
  return { present: true, summary }
}

/** Read-only inventory of pilot fixture ids on the connected database. */
export async function loadStagingPilotFixtureState(
  prisma: PrismaClient,
): Promise<StagingPilotFixtureState> {
  const ids = {
    billingGroups: [STAGING_PILOT_SUBSCRIBER_BILLING_GROUP_ID, STAGING_PILOT_NON_SUBSCRIBER_BILLING_GROUP_ID],
    accounts: [STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID, STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID],
    users: [STAGING_PILOT_SUBSCRIBER_USER_ID, STAGING_PILOT_NON_SUBSCRIBER_USER_ID],
  }

  const [billingGroups, accounts, users, memberships, bgMemberships, subscriptions, product] =
    await Promise.all([
      prisma.billingGroup.findMany({ where: { id: { in: ids.billingGroups } } }),
      prisma.customerAccount.findMany({ where: { id: { in: ids.accounts } } }),
      prisma.user.findMany({ where: { id: { in: ids.users } } }),
      prisma.customerMembership.findMany({
        where: {
          OR: [
            { userId: STAGING_PILOT_SUBSCRIBER_USER_ID, customerAccountId: STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID },
            {
              userId: STAGING_PILOT_NON_SUBSCRIBER_USER_ID,
              customerAccountId: STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID,
            },
          ],
        },
      }),
      prisma.billingGroupMembership.findMany({
        where: { customerAccountId: { in: ids.accounts } },
      }),
      prisma.commerceSubscription.findMany({
        where: {
          OR: [
            { publicId: STAGING_PILOT_SUBSCRIBER_SUBSCRIPTION_PUBLIC_ID },
            { customerAccountId: { in: ids.accounts } },
          ],
        },
        include: { product: { select: { productKey: true } } },
      }),
      prisma.commerceProduct.findUnique({
        where: { productKey: WEBSITE_SUBSCRIPTION_PRODUCT_KEY },
        include: {
          prices: {
            where: { status: 'ACTIVE' },
            orderBy: { effectiveFrom: 'desc' },
            take: 1,
          },
        },
      }),
    ])

  const billingGroupMap: StagingPilotFixtureState['billingGroups'] = {}
  for (const id of ids.billingGroups) {
    const row = billingGroups.find((r) => r.id === id)
    billingGroupMap[id] = row ? present(`BillingGroup ${id} slug=${row.slug}`) : missing(id)
  }

  const accountMap: StagingPilotFixtureState['customerAccounts'] = {}
  for (const id of ids.accounts) {
    const row = accounts.find((r) => r.id === id)
    accountMap[id] = row ? present(`CustomerAccount ${id} slug=${row.slug}`) : missing(id)
  }

  const userMap: StagingPilotFixtureState['users'] = {}
  for (const id of ids.users) {
    const row = users.find((r) => r.id === id)
    userMap[id] = row ? present(`User ${id} email=${row.email}`) : missing(id)
  }

  const membershipMap: StagingPilotFixtureState['customerMemberships'] = {}
  for (const pair of [
    `${STAGING_PILOT_SUBSCRIBER_USER_ID}:${STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID}`,
    `${STAGING_PILOT_NON_SUBSCRIBER_USER_ID}:${STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID}`,
  ]) {
    const [userId, customerAccountId] = pair.split(':')
    const row = memberships.find((m) => m.userId === userId && m.customerAccountId === customerAccountId)
    membershipMap[pair] = row
      ? present(`CustomerMembership user=${userId} account=${customerAccountId}`)
      : missing(pair)
  }

  const payload = stagingPilotFixturePayloadSpec()
  const expectedGroupByAccount = Object.fromEntries(
    payload.billingGroupMemberships.map((m) => [m.customerAccountId, m.billingGroupId]),
  )

  const bgMembershipMap: StagingPilotFixtureState['billingGroupMemberships'] = {}
  for (const accountId of ids.accounts) {
    const row = bgMemberships.find((m) => m.customerAccountId === accountId)
    const expectedGroup = expectedGroupByAccount[accountId]
    if (!row) {
      bgMembershipMap[accountId] = missing(accountId)
      continue
    }
    bgMembershipMap[accountId] =
      expectedGroup && row.billingGroupId !== expectedGroup
        ? {
            present: true,
            summary: `BillingGroupMembership account=${accountId} group=${row.billingGroupId}`,
            conflict: `Account ${accountId} must link to billing group ${expectedGroup}, not ${row.billingGroupId}`,
          }
        : present(`BillingGroupMembership account=${accountId} group=${row.billingGroupId}`)
  }

  const subscriptionMap: StagingPilotFixtureState['subscriptions'] = {}
  const pilotSub = subscriptions.find((s) => s.publicId === STAGING_PILOT_SUBSCRIBER_SUBSCRIPTION_PUBLIC_ID)
  subscriptionMap[STAGING_PILOT_SUBSCRIBER_SUBSCRIPTION_PUBLIC_ID] = pilotSub
    ? {
        present: true,
        customerAccountId: pilotSub.customerAccountId,
        summary: `CommerceSubscription ${pilotSub.publicId} status=${pilotSub.status} product=${pilotSub.product.productKey}`,
        conflict:
          pilotSub.customerAccountId !== STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID
            ? 'Subscription is not scoped to acct_pilot_staging_a'
            : pilotSub.billingGroupId !== STAGING_PILOT_SUBSCRIBER_BILLING_GROUP_ID
              ? 'Subscription billing group must match isolated payer group for account A'
              : pilotSub.status !== 'ACTIVE'
                ? 'Pilot subscription must be ACTIVE'
                : pilotSub.product.productKey !== WEBSITE_SUBSCRIPTION_PRODUCT_KEY
                  ? 'Subscription product is not website.subscription'
                  : undefined,
      }
    : missing(STAGING_PILOT_SUBSCRIBER_SUBSCRIPTION_PUBLIC_ID)

  const strayOnB = subscriptions.find(
    (s) =>
      s.customerAccountId === STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID &&
      s.product.productKey === WEBSITE_SUBSCRIPTION_PRODUCT_KEY,
  )
  if (strayOnB) {
    subscriptionMap[`stray:${STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID}`] = {
      present: true,
      customerAccountId: STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID,
      summary: 'Unexpected website.subscription on non-subscriber account B',
      conflict: 'Non-subscriber account must not hold website.subscription evidence',
    }
  }

  const catalog: StagingPilotFixtureCatalogSnapshot = {
    websiteSubscriptionProduct: product
      ? {
          present: true,
          productId: product.id,
          priceId: product.prices[0]?.id,
          summary: product.prices[0]
            ? `CommerceProduct ${WEBSITE_SUBSCRIPTION_PRODUCT_KEY} with ACTIVE price`
            : `CommerceProduct ${WEBSITE_SUBSCRIPTION_PRODUCT_KEY} without ACTIVE price`,
          conflict: product.prices[0] ? undefined : 'Missing ACTIVE CommerceProductPrice for website.subscription',
        }
      : {
          present: false,
          summary: `CommerceProduct ${WEBSITE_SUBSCRIPTION_PRODUCT_KEY} not found`,
          conflict: 'Catalog dependency — seed or activate commerce catalog on staging before subscription apply',
        },
  }

  return {
    billingGroups: billingGroupMap,
    customerAccounts: accountMap,
    users: userMap,
    customerMemberships: membershipMap,
    billingGroupMemberships: bgMembershipMap,
    subscriptions: subscriptionMap,
    catalog,
  }
}
