export type PreviewVersionBinding = {
  isCurrent: boolean
  deploymentId: string
  provider: string
  approvalId: string | null
  status: string
}

export type PreviewApprovalMetadata = {
  kind: 'website_preview'
  provider: string
  deploymentId: string
  versionLabel: string
  sourceRevision: string | null
}

export function previewApprovalMetadata(input: {
  provider: string
  deploymentId: string
  versionLabel: string
  sourceRevision: string | null
}): PreviewApprovalMetadata {
  return {
    kind: 'website_preview',
    provider: input.provider,
    deploymentId: input.deploymentId,
    versionLabel: input.versionLabel,
    sourceRevision: input.sourceRevision,
  }
}

export function readPreviewApprovalMetadata(metadata: unknown): PreviewApprovalMetadata | null {
  if (!metadata || typeof metadata !== 'object') return null
  const record = metadata as Record<string, unknown>
  if (record.kind !== 'website_preview') return null
  if (typeof record.provider !== 'string' || typeof record.deploymentId !== 'string') return null
  if (typeof record.versionLabel !== 'string') return null
  const sourceRevision = record.sourceRevision
  if (sourceRevision !== null && sourceRevision !== undefined && typeof sourceRevision !== 'string') return null
  return {
    kind: 'website_preview',
    provider: record.provider,
    deploymentId: record.deploymentId,
    versionLabel: record.versionLabel,
    sourceRevision: typeof sourceRevision === 'string' ? sourceRevision : null,
  }
}

/** Approval follows the deployment id stored on the version, never the alias URL. */
export function previewDecisionIsBound(input: {
  version: PreviewVersionBinding
  approvalId: string
  approvalMetadata: unknown
}): boolean {
  if (!input.version.isCurrent) return false
  if (input.version.status !== 'READY_FOR_REVIEW') return false
  if (!input.version.approvalId || input.version.approvalId !== input.approvalId) return false
  const metadata = readPreviewApprovalMetadata(input.approvalMetadata)
  if (!metadata) return false
  return metadata.deploymentId === input.version.deploymentId && metadata.provider === input.version.provider
}
