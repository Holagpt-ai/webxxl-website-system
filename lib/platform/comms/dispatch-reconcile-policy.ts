/** Provider lifecycle mapping — never infer carrier delivery without evidence. */

export type MessagingLifecycleSignal = 'accepted' | 'delivered' | 'failed' | 'unknown'

export type DispatchReconcileOutcome =
  | { kind: 'ACCEPTED_BY_PROVIDER' }
  | { kind: 'DELIVERED'; carrierEvidence: true }
  | { kind: 'FAILED' }
  | { kind: 'RECONCILIATION_REQUIRED'; reason: string }

export function mapMessagingProviderLifecycleToOutcome(input: {
  lifecycle: MessagingLifecycleSignal
  carrierDeliveryEvidence?: boolean
}): DispatchReconcileOutcome {
  if (input.lifecycle === 'unknown') {
    return { kind: 'RECONCILIATION_REQUIRED', reason: 'Unknown provider delivery outcome' }
  }
  if (input.lifecycle === 'failed') {
    return { kind: 'FAILED' }
  }
  if (input.lifecycle === 'accepted') {
    return { kind: 'ACCEPTED_BY_PROVIDER' }
  }
  if (input.lifecycle === 'delivered') {
    if (!input.carrierDeliveryEvidence) {
      return {
        kind: 'RECONCILIATION_REQUIRED',
        reason: 'Provider reported delivered without carrier delivery evidence',
      }
    }
    return { kind: 'DELIVERED', carrierEvidence: true }
  }
  return { kind: 'RECONCILIATION_REQUIRED', reason: 'Unrecognized lifecycle signal' }
}

export function dispatchStatusLabelFromOutcome(outcome: DispatchReconcileOutcome): string {
  switch (outcome.kind) {
    case 'ACCEPTED_BY_PROVIDER':
      return 'ACCEPTED_BY_PROVIDER'
    case 'DELIVERED':
      return 'DELIVERED'
    case 'FAILED':
      return 'FAILED'
    case 'RECONCILIATION_REQUIRED':
      return 'RECONCILIATION_REQUIRED'
    default:
      return 'RECONCILIATION_REQUIRED'
  }
}
