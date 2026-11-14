export type CustomerAiPilotWorkflowKind = 'crm_lead_intelligence' | 'marketing_seo_assistant' | 'receptionist_preparation'

export type CustomerAiPilotTaskSummary = {
  taskId: string
  publicId: string
  outcome: string
  workflowKind: CustomerAiPilotWorkflowKind
  actionHash: string
  requiresHumanApproval: boolean
  approvalId: string | null
  workflowSyncState: string
  workflowJobId: string | null
}

export const PILOT_WORKFLOW_KINDS: CustomerAiPilotWorkflowKind[] = [
  'crm_lead_intelligence',
  'marketing_seo_assistant',
  'receptionist_preparation',
]

export function pilotPrepareUrl(accountId: string, employeeId: string) {
  return `/api/v1/customer-ai/accounts/${encodeURIComponent(accountId)}/employees/${encodeURIComponent(employeeId)}/pilot-tasks/prepare`
}

export function pilotTaskUrl(accountId: string, taskId: string) {
  return `/api/v1/customer-ai/accounts/${encodeURIComponent(accountId)}/pilot-tasks/${encodeURIComponent(taskId)}`
}

export function pilotApprovalUrl(accountId: string, taskId: string) {
  return `/api/v1/customer-ai/accounts/${encodeURIComponent(accountId)}/pilot-tasks/${encodeURIComponent(taskId)}/approvals`
}