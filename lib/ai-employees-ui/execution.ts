'use client'

import { useAi } from '@/lib/ai-employees-ui/client'
import type { AiWorkforceExecutionSummary } from '@/lib/platform/ai-workforce-execution/summary'
import type { AiWorkforceExecutionSlice } from '@/lib/platform/ai-workforce-execution/types'

export type { AiWorkforceExecutionSummary, AiWorkforceExecutionSlice }

export const AI_EXECUTION_SUMMARY_URL = '/api/v1/ai-workforce/execution/summary'

export function useAiExecutionSummary(accountId: string) {
  const swr = useAi<{ summary: AiWorkforceExecutionSummary }>(
    `${AI_EXECUTION_SUMMARY_URL}?${new URLSearchParams({ customerAccountId: accountId }).toString()}`,
  )
  const raw = swr.data?.summary
  return { ...swr, summary: raw && raw.customerAccountId === accountId ? raw : undefined }
}
