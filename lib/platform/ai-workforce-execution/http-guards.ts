import { NextResponse } from 'next/server'
import { isCustomerAiWorkforceEnabled } from '@/config/customer-ai-workforce'
import { isAiWorkforceExecutionHttpMutationEnabled } from '@/lib/platform/ai-workforce-execution/runtime-gates'

export function aiWorkforceDisabledResponse() {
  if (isCustomerAiWorkforceEnabled()) return null
  return NextResponse.json(
    { code: 'AI_WORKFORCE_DISABLED', message: 'Customer AI workforce backend is disabled' },
    { status: 503 },
  )
}

export function aiWorkforceHttpMutationDisabledResponse() {
  const disabled = aiWorkforceDisabledResponse()
  if (disabled) return disabled
  if (isAiWorkforceExecutionHttpMutationEnabled()) return null
  return NextResponse.json(
    {
      code: 'EXECUTION_DISABLED',
      message:
        'AI workforce HTTP mutations are disabled. Batch 6 orchestration is process-local; production mutations require connected Batch 6 durable persistence (CUSTOMER_AI_PILOT_DURABLE_ENABLED does not apply).',
    },
    { status: 503 },
  )
}
