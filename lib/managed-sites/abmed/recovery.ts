export type AbmedApprovalRecoveryMetadata = {
  remoteCampaignId: string
  remoteVersion: number
  remoteStatus: string
  draftApplied: true
  requestedApproval: false
  recoveryStage: 'request_approval'
}

export function parseAbmedApprovalRecovery(value: unknown): AbmedApprovalRecoveryMetadata | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (
    record.draftApplied === true &&
    record.recoveryStage === 'request_approval' &&
    typeof record.remoteCampaignId === 'string' &&
    typeof record.remoteVersion === 'number' &&
    Number.isInteger(record.remoteVersion)
  ) {
    return {
      remoteCampaignId: record.remoteCampaignId,
      remoteVersion: record.remoteVersion,
      remoteStatus: typeof record.remoteStatus === 'string' ? record.remoteStatus : 'draft',
      draftApplied: true,
      requestedApproval: false,
      recoveryStage: 'request_approval',
    }
  }
  return null
}

export function isAbmedApprovalRecoveryResultMetadata(value: unknown): boolean {
  return parseAbmedApprovalRecovery(value) != null
}
