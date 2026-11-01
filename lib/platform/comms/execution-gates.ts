import {
  isCommunicationsOutboundEnabled,
  isCommsIntegrationGatesEnabled,
  isEmailSendEnabled,
  isSmsSendEnabled,
} from '@/config/comms-backend'
import type { CommsResult } from '@/lib/platform/comms/types'

export type CommsDispatchPhase = 'PROVIDER_DISPATCH' | 'PROVIDER_RECONCILE'

export function commsProviderDispatchBlocked(): CommsResult<never> | null {
  if (!isCommsIntegrationGatesEnabled()) {
    return {
      ok: false,
      code: 'NOT_CONFIGURED',
      message: 'COMMS_INTEGRATION_GATES_ENABLED is false',
    }
  }
  if (!isCommunicationsOutboundEnabled()) {
    return {
      ok: false,
      code: 'NOT_CONFIGURED',
      message: 'COMMUNICATIONS_OUTBOUND_ENABLED is false; dispatch remains blocked',
    }
  }
  if (!isSmsSendEnabled() && !isEmailSendEnabled()) {
    return {
      ok: false,
      code: 'NOT_CONFIGURED',
      message: 'SMS_SEND_ENABLED and EMAIL_SEND_ENABLED are false',
    }
  }
  return null
}

export function commsProviderReconcileBlocked(): CommsResult<never> | null {
  if (!isCommsIntegrationGatesEnabled()) {
    return {
      ok: false,
      code: 'NOT_CONFIGURED',
      message: 'COMMS_INTEGRATION_GATES_ENABLED is false',
    }
  }
  return null
}
