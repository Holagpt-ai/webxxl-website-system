import type { ManagedSiteConnectionType } from '@prisma/client'

export type AdapterConnectionState = 'connected' | 'not_connected' | 'manual'

export type AdapterConnectionStatus = {
  state: AdapterConnectionState
  detail: string
}

export type ManagedSiteContext = {
  id: string
  domain: string
  adapterKey: string
  connectionType: ManagedSiteConnectionType
  connectionRef: string | null
}

export type AdapterResult = { ok: true; metadata?: Record<string, unknown> } | { ok: false; reason: 'unavailable' | 'invalid' | 'not_connected' }

export interface ManagedSiteAdapter {
  key: string
  connectionStatus(site: ManagedSiteContext): Promise<AdapterConnectionStatus>
  listCapabilities(site: ManagedSiteContext): Promise<string[]>
  readResource(site: ManagedSiteContext, capabilityKey: string): Promise<AdapterResult>
  validateChange(site: ManagedSiteContext, capabilityKey: string, payload: Record<string, unknown> | null): Promise<AdapterResult>
  createPreview(site: ManagedSiteContext, capabilityKey: string, payload: Record<string, unknown> | null): Promise<AdapterResult>
  applyChange(site: ManagedSiteContext, capabilityKey: string, payload: Record<string, unknown> | null): Promise<AdapterResult>
}

/**
 * Writes stay unavailable until a real control contract is registered.
 * Larger or remote changes must not be reported as applied.
 */
function unavailableAdapter(key: string, detail: string): ManagedSiteAdapter {
  const status = async (site: ManagedSiteContext): Promise<AdapterConnectionStatus> => {
    if (site.connectionType === 'MANUAL') return { state: 'manual', detail }
    return { state: 'not_connected', detail }
  }
  const refused = async (): Promise<AdapterResult> => ({ ok: false, reason: 'unavailable' })
  return {
    key,
    connectionStatus: status,
    async listCapabilities() {
      return []
    },
    readResource: refused,
    validateChange: refused,
    createPreview: refused,
    applyChange: refused,
  }
}

export const manualAdapter = unavailableAdapter('manual', 'This site is managed manually. Remote changes are not connected.')

/**
 * Known ABMED sites use this adapter. No campaign-control contract is present in this repository,
 * so writes stay unavailable instead of calling a guessed endpoint.
 */
export const abmedAdapter = unavailableAdapter(
  'abmed',
  'No live campaign-control contract is configured. Use the existing site admin until the adapter is connected.',
)

const ADAPTERS: Record<string, ManagedSiteAdapter> = {
  manual: manualAdapter,
  abmed: abmedAdapter,
  'webxxl-native': unavailableAdapter('webxxl-native', 'The native site adapter is not connected yet.'),
  wordpress: unavailableAdapter('wordpress', 'The WordPress adapter is not connected yet.'),
  'custom-api': unavailableAdapter('custom-api', 'The custom API adapter is not connected yet.'),
}

export function getManagedSiteAdapter(adapterKey: string): ManagedSiteAdapter {
  return ADAPTERS[adapterKey] ?? manualAdapter
}
