import {
  isInternalWorkforceEnabled,
  isPaperclipExecutionEnabled,
  paperclipBaseUrl,
} from '@/config/workforce'
import type { ProviderAuthContext, ProviderResult, WorkforceProvider } from '@/lib/platform/providers/types'
import { INTERNAL_AGENT_DEFINITIONS } from '@/lib/platform/workforce/internal-agents'

const PAPERCLIP_PINNED_TAG = 'v2026.325.0'

function unavailable<T>(message: string): ProviderResult<T> {
  return { ok: false, code: 'NOT_CONFIGURED', message }
}

/**
 * Paperclip adapter — live HTTP calls are gated off unless explicitly enabled.
 * Verified upstream reference: paperclipai/paperclip @ v2026.325.0 (INFRA-02).
 */
export function createPaperclipWorkforceProvider(): WorkforceProvider {
  return {
    kind: 'workforce',
    key: 'paperclip',
    displayName: 'Paperclip',
    availability: 'NOT_ACTIVATED',
    replaceable: true,
    installed: false,
    async listAgents(_context: ProviderAuthContext) {
      if (!isInternalWorkforceEnabled()) {
        return unavailable('Internal workforce disabled')
      }
      if (!isPaperclipExecutionEnabled()) {
        return unavailable(
          `Paperclip execution disabled (pin ${PAPERCLIP_PINNED_TAG}). Use synthetic provider in tests.`,
        )
      }
      if (!paperclipBaseUrl()) {
        return unavailable('WORKFORCE_BASE_URL / PAPERCLIP_BASE_URL not configured')
      }
      return unavailable('Live Paperclip HTTP integration is not activated in AGENT-03')
    },
  }
}

export function paperclipAgentDirectoryForRegistry() {
  return INTERNAL_AGENT_DEFINITIONS.map((a) => ({
    webxxlAgentId: a.id,
    paperclipExternalRef: null as string | null,
    pinnedUpstream: PAPERCLIP_PINNED_TAG,
  }))
}
