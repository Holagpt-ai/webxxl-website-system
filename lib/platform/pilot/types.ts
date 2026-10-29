/** Pilot readiness row — never infer operational capability from build success alone. */
export type PilotEvidenceKind =
  | 'APPLICATION_CODE'
  | 'DATABASE_MIGRATION'
  | 'BACKEND_FLAG'
  | 'ENTITLEMENT_POLICY'
  | 'PROVIDER_CONFIG'
  | 'AUTHORIZED_ACCOUNT'
  | 'AUTHENTICATED_TEST'
  | 'OPERATIONAL_CAPABILITY'

export type PilotCheckStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'UNVERIFIED'

export type PilotCheckResult = {
  id: string
  label: string
  evidenceKind: PilotEvidenceKind
  status: PilotCheckStatus
  summary: string
  detail?: string
}

export type PilotReadinessReport = {
  generatedAt: string
  repositorySha: string
  overallReadyForControlledPilot: false
  checks: PilotCheckResult[]
  ownerDecisionsRequired: string[]
}
