import {
  isCustomerAiExecutionEnabled,
  isCustomerAiOutboundEnabled,
  isCustomerAiPilotPrepEnabled,
  isCustomerAiWorkforceEnabled,
} from '@/config/customer-ai-workforce'
import type { CustomerAiResult } from '@/lib/platform/customer-ai-workforce/types'

export function assertCustomerAiPilotPrepEnabled(): CustomerAiResult<true> {
  if (!isCustomerAiWorkforceEnabled()) {
    return { ok: false, error: 'AI_WORKFORCE_DISABLED', message: 'Customer AI workforce backend is disabled' }
  }
  if (!isCustomerAiPilotPrepEnabled()) {
    return { ok: false, error: 'EXECUTION_DISABLED', message: 'Customer AI pilot preparation is disabled' }
  }
  return { ok: true, value: true }
}

/** Future execution boundary — Batch 36 stops before any external dispatch. */
export function blockCustomerAiPilotExternalExecution(): CustomerAiResult<never> {
  if (!isCustomerAiExecutionEnabled()) {
    return { ok: false, error: 'EXECUTION_DISABLED', message: 'Live AI execution remains disabled' }
  }
  if (isCustomerAiOutboundEnabled()) {
    return { ok: false, error: 'EXECUTION_DISABLED', message: 'Outbound effects remain gated separately' }
  }
  return { ok: false, error: 'EXECUTION_DISABLED', message: 'Pilot preparation does not authorize execution' }
}

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /grant\s+me\s+admin/i,
  /send\s+(all\s+)?(sms|email)/i,
  /customerAi\.messages\.sendLive/i,
  /customerAi\.db\.rawQuery/i,
  /customerAi\.clinical\.readPhi/i,
  /billing[-\s]?group\s+sibling/i,
]

export function detectCustomerAiPromptInjection(text: string): string | null {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) return 'Untrusted prompt attempted policy bypass'
  }
  return null
}
