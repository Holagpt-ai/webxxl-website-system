import type { CommsDataClassification } from '@prisma/client'
import type { CommsPolicyDecision } from '@/lib/platform/comms/types'

export function evaluateRegulatedWorkflowGate(input: {
  dataClassification: CommsDataClassification
  channel: string
  approvedVendorWorkflow: boolean
}): CommsPolicyDecision {
  if (input.dataClassification === 'REGULATED_HEALTHCARE' && !input.approvedVendorWorkflow) {
    return 'COMPLIANCE_REVIEW_REQUIRED'
  }
  if (input.dataClassification === 'CREDENTIAL' || input.dataClassification === 'SECURITY_AUDIT') {
    return 'DENIED'
  }
  return 'ALLOW_PREPARATION'
}
