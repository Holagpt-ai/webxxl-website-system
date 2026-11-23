import { prisma } from '@/lib/db'
import type { SocialResult } from '@/lib/platform/social/types'

export type PostizTenantBoundaryPrisma = {
  customerAccountId: string
  workspaceMappingId: string
  externalWorkspaceRef: string
  secretRef: string
  allowedExternalIntegrationIds: Set<string>
  isolationStrategy: 'webxxl_connection_allowlist'
}

export async function resolvePostizTenantBoundaryFromPrisma(
  customerAccountId: string,
): Promise<SocialResult<PostizTenantBoundaryPrisma>> {
  const connections = await prisma.businessSocialConnection.findMany({
    where: { customerAccountId, providerKey: 'postiz' },
    take: 200,
  })
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
  const mapping = await prisma.socialProviderWorkspaceMapping.findFirst({
    where: { id: workspaceMappingId, customerAccountId },
  })
  if (!mapping) {
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

export function assertExternalIntegrationInTenantBoundaryPrisma(
  boundary: PostizTenantBoundaryPrisma,
  externalIntegrationId: string,
): SocialResult<true> {
  if (!boundary.allowedExternalIntegrationIds.has(externalIntegrationId)) {
    return {
      ok: false,
      code: 'INTEGRATION_NOT_AUTHORIZED',
      message: 'Integration not on tenant connection allowlist',
    }
  }
  return { ok: true, value: true }
}

export async function assertPostizExternalIntegrationForSchedulePrisma(
  customerAccountId: string,
  externalIntegrationId: string,
): Promise<SocialResult<true>> {
  const boundary = await resolvePostizTenantBoundaryFromPrisma(customerAccountId)
  if (!boundary.ok) return boundary
  return assertExternalIntegrationInTenantBoundaryPrisma(boundary.value, externalIntegrationId)
}