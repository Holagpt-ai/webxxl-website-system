import type { PostizIntegrationView } from '@/lib/platform/providers/postiz-social'
import type { SocialStore } from '@/lib/platform/social/in-memory-store'
import type { BusinessSocialConnectionRecord, SocialResult } from '@/lib/platform/social/types'

/**
 * Postiz Public API credentials are often org-scoped. WebXXL enforces tenant boundaries
 * by intersecting provider integrations with BusinessSocialConnection allowlists per account.
 * Per-account API keys (when available) remain the preferred production isolation strategy.
 */
export type PostizTenantBoundary = {
  customerAccountId: string
  workspaceMappingId: string
  externalWorkspaceRef: string
  secretRef: string
  allowedExternalIntegrationIds: Set<string>
  isolationStrategy: 'webxxl_connection_allowlist'
}

export function resolvePostizTenantBoundaryFromStore(
  store: SocialStore,
  customerAccountId: string,
): SocialResult<PostizTenantBoundary> {
  const connections = [...store.connections.values()].filter(
    (row) => row.customerAccountId === customerAccountId && row.providerKey === 'postiz',
  )
  if (connections.length === 0) {
    return {
      ok: false,
      code: 'WORKSPACE_ISOLATION_REQUIRED',
      message: 'No verified Postiz workspace mapping for customer account',
    }
  }
  const connected = connections.filter((row) => row.connectionState === 'CONNECTED')
  if (connected.length === 0) {
    return {
      ok: false,
      code: 'WORKSPACE_ISOLATION_REQUIRED',
      message: 'No connected Postiz channels for customer account',
    }
  }
  const workspaceIds = new Set(connected.map((row) => row.workspaceMappingId))
  if (workspaceIds.size !== 1) {
    return {
      ok: false,
      code: 'WORKSPACE_ISOLATION_REQUIRED',
      message: 'Ambiguous Postiz workspace mapping; fail closed',
    }
  }
  const workspaceMappingId = [...workspaceIds][0]!
  const mapping = store.workspaceMappings.get(workspaceMappingId)
  if (!mapping || mapping.customerAccountId !== customerAccountId) {
    return {
      ok: false,
      code: 'WORKSPACE_ISOLATION_REQUIRED',
      message: 'Postiz workspace mapping mismatch',
    }
  }
  if (mapping.connectionState !== 'CONNECTED') {
    return {
      ok: false,
      code: 'WORKSPACE_ISOLATION_REQUIRED',
      message: 'Postiz workspace is not connected',
    }
  }
  return {
    ok: true,
    value: {
      customerAccountId,
      workspaceMappingId,
      externalWorkspaceRef: mapping.externalWorkspaceRef,
      secretRef: mapping.secretRef,
      allowedExternalIntegrationIds: new Set(connected.map((row) => row.externalChannelRef)),
      isolationStrategy: 'webxxl_connection_allowlist',
    },
  }
}

export function filterIntegrationsToTenantBoundary(
  integrations: PostizIntegrationView[],
  boundary: PostizTenantBoundary,
): PostizIntegrationView[] {
  return integrations.filter((row) => boundary.allowedExternalIntegrationIds.has(row.id))
}

export function assertExternalIntegrationInTenantBoundary(
  boundary: PostizTenantBoundary,
  externalIntegrationId: string,
): SocialResult<true> {
  if (!boundary.allowedExternalIntegrationIds.has(externalIntegrationId)) {
    return {
      ok: false,
      code: 'INTEGRATION_NOT_AUTHORIZED',
      message: 'External integration is not mapped to this customer account',
    }
  }
  return { ok: true, value: true }
}

export function assertConnectionExternalRefMatches(
  connection: BusinessSocialConnectionRecord,
  externalIntegrationId: string,
): SocialResult<true> {
  if (connection.externalChannelRef !== externalIntegrationId) {
    return {
      ok: false,
      code: 'INTEGRATION_NOT_AUTHORIZED',
      message: 'External integration does not match WebXXL channel mapping',
    }
  }
  return { ok: true, value: true }
}
