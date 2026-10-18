import { isCrmExternalSyncEnabled } from '@/config/crm-backend'
import type { CrmProvider, CrmProviderCapabilities, ProviderAuthContext, ProviderResult } from '@/lib/platform/providers/types'

export type TwentyHttpTransport = (request: {
  method: 'GET' | 'POST' | 'PATCH'
  path: string
  authorization: string
  body?: unknown
}) => Promise<{ status: number; json: unknown }>

/** Twenty CRM candidate adapter — verified REST paths from public docs only; not installed in CRM-05. */
export function createTwentyCrmProvider(options?: {
  transport?: TwentyHttpTransport
  secretResolver?: (ref: string) => string | null
  workspaceResolver?: (customerAccountId: string) => ProviderResult<{ workspaceId: string; secretRef: string }>
}): CrmProvider {
  const capabilities: CrmProviderCapabilities = {
    contacts: true,
    companies: true,
    pipelines: true,
    deals: true,
    tasks: false,
    customFields: true,
    activities: true,
    sync: true,
    export: true,
  }

  return {
    kind: 'crm',
    key: 'twenty',
    displayName: 'Twenty CRM',
    availability: 'CANDIDATE',
    replaceable: true,
    installed: false,
    describeCapabilities() {
      return capabilities
    },
    async searchContacts(context, query) {
      if (!isCrmExternalSyncEnabled()) {
        return { ok: false, code: 'NOT_CONFIGURED', message: 'CRM external sync disabled' }
      }
      if (!options?.workspaceResolver || !options.transport) {
        return { ok: false, code: 'NOT_CONFIGURED', message: 'Twenty workspace mapping not configured' }
      }
      const workspace = options.workspaceResolver(context.customerAccountId)
      if (!workspace.ok) return workspace
      const apiKey = options.secretResolver?.(workspace.value.secretRef)
      if (!apiKey) return { ok: false, code: 'NOT_CONFIGURED', message: 'Twenty API credentials not configured' }
      const res = await options.transport({
        method: 'GET',
        path: '/rest/people',
        authorization: `Bearer ${apiKey}`,
      })
      if (res.status === 401 || res.status === 403) {
        return { ok: false, code: 'UNAUTHORIZED', message: 'Twenty rejected credentials' }
      }
      if (res.status >= 400) {
        return { ok: false, code: 'UNAVAILABLE', message: 'Twenty API unavailable' }
      }
      void query
      return { ok: true, value: [] }
    },
    async syncWorkspace(context) {
      if (!isCrmExternalSyncEnabled()) {
        return { ok: false, code: 'NOT_CONFIGURED', message: 'CRM external sync disabled' }
      }
      return { ok: false, code: 'NOT_CONFIGURED', message: 'Twenty sync not activated in CRM-05' }
    },
  }
}
