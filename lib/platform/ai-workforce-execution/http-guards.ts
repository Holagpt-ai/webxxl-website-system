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
        'AI workforce HTTP mutations are disabled. Process-local orchestration is not globally enforced until owner gates and durable persistence are satisfied.',
    },
    { status: 503 },
  )
}
