import type { StagingPilotFixturePlan } from '@/lib/platform/pilot/staging-pilot-fixture-plan'
import {
  stagingPilotFixturePayloadSpec,
  type StagingPilotFixturePayloadSpec,
} from '@/lib/platform/pilot/staging-pilot-fixture-payloads'
import type { StagingPilotFixtureState } from '@/lib/platform/pilot/staging-pilot-fixture-inspect'
import {
  STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID,
  STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID,
  STAGING_PILOT_SUBSCRIBER_SUBSCRIPTION_PUBLIC_ID,
} from '@/lib/platform/pilot/staging-pilot-fixture-ids'

export type StagingPilotFixtureActionKind = 'noop' | 'create' | 'blocked'

export type StagingPilotFixtureAction = {
  stepId: string
  entity: string
  kind: StagingPilotFixtureActionKind
  naturalKey: Record<string, string>
  detail: string
}

export type StagingPilotFixtureApplyReport = {
  planIdempotencyKey: string
  mode: 'dry-run' | 'apply'
  actions: StagingPilotFixtureAction[]
  conflicts: string[]
  catalogBlocked: boolean
  authIdentityNote: string
  readyForApply: boolean
}

const AUTH_NOTE =
  'Fixture provisioning creates User rows with staging-only emails. Auth.js sign-in still requires a separate owner-configured provider or magic-link flow on the staging preview host — no passwords or OAuth tokens are stored in this tool.'

function pushCreate(
  actions: StagingPilotFixtureAction[],
  stepId: string,
  entity: string,
  naturalKey: Record<string, string>,
  detail: string,
): void {
  actions.push({ stepId, entity, kind: 'create', naturalKey, detail })
}

function pushNoop(
  actions: StagingPilotFixtureAction[],
  stepId: string,
  entity: string,
  naturalKey: Record<string, string>,
  detail: string,
): void {
  actions.push({ stepId, entity, kind: 'noop', naturalKey, detail })
}

export function buildStagingPilotFixtureApplyReport(input: {
  plan: StagingPilotFixturePlan
  state: StagingPilotFixtureState | null
  mode: 'dry-run' | 'apply'
}): StagingPilotFixtureApplyReport {
  const payload = stagingPilotFixturePayloadSpec()
  const actions: StagingPilotFixtureAction[] = []
  const conflicts: string[] = []

  if (!input.state) {
    for (const step of input.plan.steps) {
      pushCreate(actions, step.stepId, step.entity, step.naturalKey, `Would create — ${step.payloadSummary}`)
    }
    return {
      planIdempotencyKey: input.plan.idempotencyKey,
      mode: input.mode,
      actions,
      conflicts,
      catalogBlocked: true,
      authIdentityNote: AUTH_NOTE,
      readyForApply: false,
    }
  }

  for (const value of Object.values(input.state.billingGroups)) {
    if (value.conflict) conflicts.push(value.conflict)
  }
  for (const value of Object.values(input.state.customerAccounts)) {
    if (value.conflict) conflicts.push(value.conflict)
  }
  for (const value of Object.values(input.state.billingGroupMemberships)) {
    if (value.conflict) conflicts.push(value.conflict)
  }
  for (const value of Object.values(input.state.subscriptions)) {
    if (value.conflict) conflicts.push(value.conflict)
  }
  if (input.state.catalog.websiteSubscriptionProduct.conflict) {
    conflicts.push(input.state.catalog.websiteSubscriptionProduct.conflict)
  }

  reconcileBillingGroups(payload, input.state, actions)
  reconcileAccounts(payload, input.state, actions)
  reconcileUsers(payload, input.state, actions)
  reconcileCustomerMemberships(payload, input.state, actions)
  reconcileBillingGroupMemberships(payload, input.state, actions)
  reconcileSubscription(payload, input.state, actions, conflicts)

  const catalogBlocked =
    !input.state.catalog.websiteSubscriptionProduct.present ||
    !input.state.catalog.websiteSubscriptionProduct.priceId

  const readyForApply =
    input.mode === 'apply' &&
    conflicts.length === 0 &&
    !catalogBlocked &&
    actions.some((a) => a.kind === 'create')

  return {
    planIdempotencyKey: input.plan.idempotencyKey,
    mode: input.mode,
    actions,
    conflicts: [...new Set(conflicts)],
    catalogBlocked,
    authIdentityNote: AUTH_NOTE,
    readyForApply,
  }
}

function reconcileBillingGroups(
  payload: StagingPilotFixturePayloadSpec,
  state: StagingPilotFixtureState,
  actions: StagingPilotFixtureAction[],
): void {
  for (const group of payload.billingGroups) {
    const snap = state.billingGroups[group.id]
    const stepId = group.id === payload.billingGroups[0]!.id ? '01-billing-group-subscriber' : '02-billing-group-non-subscriber'
    if (snap?.present) {
      pushNoop(actions, stepId, 'BillingGroup', { id: group.id }, snap.summary)
    } else {
      pushCreate(actions, stepId, 'BillingGroup', { id: group.id }, `Create BillingGroup ${group.slug}`)
    }
  }
}

function reconcileAccounts(
  payload: StagingPilotFixturePayloadSpec,
  state: StagingPilotFixtureState,
  actions: StagingPilotFixtureAction[],
): void {
  for (const account of payload.customerAccounts) {
    const snap = state.customerAccounts[account.id]
    const stepId =
      account.id === STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID
        ? '03-customer-account-subscriber'
        : '04-customer-account-non-subscriber'
    if (snap?.present) {
      pushNoop(actions, stepId, 'CustomerAccount', { id: account.id }, snap.summary)
    } else {
      pushCreate(actions, stepId, 'CustomerAccount', { id: account.id }, `Create CustomerAccount ${account.slug}`)
    }
  }
}

function reconcileUsers(
  payload: StagingPilotFixturePayloadSpec,
  state: StagingPilotFixtureState,
  actions: StagingPilotFixtureAction[],
): void {
  for (const user of payload.users) {
    const snap = state.users[user.id]
    const stepId = user.id === payload.users[0]!.id ? '05a-user-subscriber' : '05b-user-non-subscriber'
    if (snap?.present) {
      pushNoop(actions, stepId, 'User', { id: user.id }, snap.summary)
    } else {
      pushCreate(actions, stepId, 'User', { id: user.id }, `Create User ${user.email} (identity only — no OAuth)`)
    }
  }
}

function reconcileCustomerMemberships(
  payload: StagingPilotFixturePayloadSpec,
  state: StagingPilotFixtureState,
  actions: StagingPilotFixtureAction[],
): void {
  for (const membership of payload.customerMemberships) {
    const key = `${membership.userId}:${membership.customerAccountId}`
    const snap = state.customerMemberships[key]
    const stepId =
      membership.customerAccountId === STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID
        ? '05-membership-subscriber'
        : '06-membership-non-subscriber'
    if (snap?.present) {
      pushNoop(actions, stepId, 'CustomerMembership', { userId: membership.userId, customerAccountId: membership.customerAccountId }, snap.summary)
    } else {
      pushCreate(
        actions,
        stepId,
        'CustomerMembership',
        { userId: membership.userId, customerAccountId: membership.customerAccountId },
        'Create membership (no duplicate if pair exists)',
      )
    }
  }
}

function reconcileBillingGroupMemberships(
  payload: StagingPilotFixturePayloadSpec,
  state: StagingPilotFixtureState,
  actions: StagingPilotFixtureAction[],
): void {
  for (const link of payload.billingGroupMemberships) {
    const snap = state.billingGroupMemberships[link.customerAccountId]
    const stepId = `bgm-${link.customerAccountId}`
    if (snap?.present) {
      pushNoop(actions, stepId, 'BillingGroupMembership', { id: link.id }, snap.summary)
    } else {
      pushCreate(actions, stepId, 'BillingGroupMembership', { id: link.id }, 'Link account to isolated payer group')
    }
  }
}

function reconcileSubscription(
  payload: StagingPilotFixturePayloadSpec,
  state: StagingPilotFixtureState,
  actions: StagingPilotFixtureAction[],
  conflicts: string[],
): void {
  const snap = state.subscriptions[STAGING_PILOT_SUBSCRIBER_SUBSCRIPTION_PUBLIC_ID]
  if (snap?.present && !snap.conflict) {
    pushNoop(
      actions,
      '07-subscription-subscriber',
      'CommerceSubscription',
      { publicId: STAGING_PILOT_SUBSCRIBER_SUBSCRIPTION_PUBLIC_ID },
      snap.summary,
    )
    return
  }
  if (snap?.conflict) {
    actions.push({
      stepId: '07-subscription-subscriber',
      entity: 'CommerceSubscription',
      kind: 'blocked',
      naturalKey: { publicId: STAGING_PILOT_SUBSCRIBER_SUBSCRIPTION_PUBLIC_ID },
      detail: snap.conflict,
    })
    return
  }
  if (state.catalog.websiteSubscriptionProduct.priceId) {
    pushCreate(
      actions,
      '07-subscription-subscriber',
      'CommerceSubscription',
      { publicId: payload.subscription.publicId },
      'Create ACTIVE website.subscription on account A only',
    )
  } else {
    actions.push({
      stepId: '07-subscription-subscriber',
      entity: 'CommerceSubscription',
      kind: 'blocked',
      naturalKey: { publicId: payload.subscription.publicId },
      detail: 'Blocked until website.subscription catalog + ACTIVE price exist on staging',
    })
    conflicts.push('Catalog not ready for website.subscription on staging')
  }

  if (state.subscriptions[`stray:${STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID}`]) {
    conflicts.push('Remove or reconcile unexpected subscription on account B before apply')
  }
}
