export type CustomerAiPilotWorkflowKind =
  | 'crm_lead_intelligence'
  | 'marketing_seo_assistant'
  | 'receptionist_preparation'

export type CustomerAiPilotOutcomeLabel = 'PREPARED' | 'PENDING_APPROVAL' | 'BLOCKED' | 'UNVERIFIED'

export type CustomerAiPilotTrustedDataSource = 'SERVER' | 'TEST_SYNTHETIC'

export type CustomerAiPilotTaskRecord = {
  id: string
  publicId: string
  customerAccountId: string
  managedSiteId: string | null
  employeeId: string
  workflowKind: CustomerAiPilotWorkflowKind
  toolKey: string
  accessMode: 'READ' | 'WRITE'
  idempotencyKey: string
  requestFingerprint: string
  outcome: CustomerAiPilotOutcomeLabel
  actionHash: string
  draftPayload: Record<string, unknown>
  provenance: {
    source: 'DETERMINISTIC_PILOT_V1'
    contentLabel: 'PREPARED_DRAFT'
    locale: string
    correlationId: string
    preparedAt: string
    actorUserId: string
  }
  requiresHumanApproval: boolean
  approvalId: string | null
  estimatedCostUnits: number | null
  blockedReason: string | null
  createdAt: Date
}

export type CustomerAiPilotApprovalRecord = {
  id: string
  preparedTaskId: string
  customerAccountId: string
  managedSiteId: string | null
  employeeId: string
  toolKey: string
  workflowKind: CustomerAiPilotWorkflowKind
  actionHash: string
  allowedAction: string
  destinationRef: string | null
  approvedByUserId: string
  approverPlatformRole: string
  maxCostUnits: number | null
  expiresAt: Date
  consumedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
}
