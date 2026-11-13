import type { AiWorkforceCoverageState } from '@/lib/platform/ai-workforce-execution/types'

/**
 * Server-side channel coverage. Client-supplied connectivity is never trusted.
 * Returns COVERAGE_UNVERIFIED until a verified comms integration read path is composed.
 */
export function resolveServerChannelCoverageState(_input: {
  customerAccountId: string
  toolKey: string
}): AiWorkforceCoverageState {
  return 'COVERAGE_UNVERIFIED'
}
