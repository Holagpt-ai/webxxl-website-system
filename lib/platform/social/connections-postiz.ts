import type { PostizIntegrationView, PostizSocialPublisher } from '@/lib/platform/providers/postiz-social'
import type { SocialStore } from '@/lib/platform/social/in-memory-store'
import {
  assertExternalIntegrationInTenantBoundary,
  filterIntegrationsToTenantBoundary,
  resolvePostizTenantBoundaryFromStore,
} from '@/lib/platform/social/postiz-isolation'
import { listConnectionsForAccount } from '@/lib/platform/social/connections-service'
import type { SocialResult } from '@/lib/platform/social/types'
import type { SocialChannelSummary } from '@/lib/platform/providers/types'

export async function listPostizChannelsForAccount(
  store: SocialStore,
  customerAccountId: string,
  managedSiteId: string | undefined,
  publisher: PostizSocialPublisher,
  options?: { verifyWithApi?: boolean },
): Promise<SocialResult<SocialChannelSummary[]>> {
  const boundary = resolvePostizTenantBoundaryFromStore(store, customerAccountId)
  if (!boundary.ok) return boundary

  const connections = listConnectionsForAccount(store, customerAccountId, managedSiteId).filter(
    (row) => row.providerKey === 'postiz' && boundary.value.allowedExternalIntegrationIds.has(row.externalChannelRef),
  )

  let integrations: PostizIntegrationView[] | undefined
  if (options?.verifyWithApi) {
    const listed = await publisher.listIntegrations()
    if (!listed.ok) return listed
    integrations = filterIntegrationsToTenantBoundary(listed.value, boundary.value)
    const visible = new Set(integrations.map((row) => row.id))
    const verified = connections.filter((row) => visible.has(row.externalChannelRef))
    return {
      ok: true,
      value: verified.map((row) => ({
        id: row.id,
        name: row.displayName,
        providerIdentifier: row.platform,
      })),
    }
  }

  return {
    ok: true,
    value: connections.map((row) => ({
      id: row.id,
      name: row.displayName,
      providerIdentifier: row.platform,
    })),
  }
}

export async function getPostizChannelStatusForAccount(
  store: SocialStore,
  customerAccountId: string,
  connectionId: string,
  publisher: PostizSocialPublisher,
  options?: { verifyWithApi?: boolean },
): Promise<
  SocialResult<{ connected: boolean; name: string; providerIdentifier: string; externalIntegrationId: string }>
> {
  const boundary = resolvePostizTenantBoundaryFromStore(store, customerAccountId)
  if (!boundary.ok) return boundary

  const connection = store.connections.get(connectionId)
  if (!connection || connection.customerAccountId !== customerAccountId) {
    return { ok: false, code: 'NOT_FOUND', message: 'Social connection not found' }
  }
  const allowed = assertExternalIntegrationInTenantBoundary(boundary.value, connection.externalChannelRef)
  if (!allowed.ok) return allowed

  if (options?.verifyWithApi) {
    const listed = await publisher.listIntegrations()
    if (!listed.ok) return listed
    const match = filterIntegrationsToTenantBoundary(listed.value, boundary.value).find(
      (row) => row.id === connection.externalChannelRef,
    )
    if (!match) {
      return {
        ok: false,
        code: 'INTEGRATION_NOT_AUTHORIZED',
        message: 'Integration not visible under tenant-scoped credentials',
      }
    }
    return {
      ok: true,
      value: {
        connected: connection.connectionState === 'CONNECTED',
        name: match.name,
        providerIdentifier: match.providerIdentifier,
        externalIntegrationId: connection.externalChannelRef,
      },
    }
  }

  return {
    ok: true,
    value: {
      connected: connection.connectionState === 'CONNECTED',
      name: connection.displayName,
      providerIdentifier: connection.platform,
      externalIntegrationId: connection.externalChannelRef,
    },
  }
}

export function assertPostizExternalIntegrationForSchedule(
  store: SocialStore,
  customerAccountId: string,
  externalIntegrationId: string,
): SocialResult<true> {
  const boundary = resolvePostizTenantBoundaryFromStore(store, customerAccountId)
  if (!boundary.ok) return boundary
  return assertExternalIntegrationInTenantBoundary(boundary.value, externalIntegrationId)
}
