import {
  isCustomerAiChatwootAdapterEnabled,
  isCustomerAiExecutionEnabled,
  isCustomerAiOutboundEnabled,
  isCustomerAiPilotDurableEnabled,
  isCustomerAiPilotHttpEnabled,
  isCustomerAiPilotPrepEnabled,
  isCustomerAiPilotWorkflowEnqueueEnabled,
  isCustomerAiWorkforceEnabled,
} from '@/config/customer-ai-workforce'
import {
  isWorkflowBackendEnabled,
  isWorkflowEnqueueEnabled,
  isWorkflowExternalEffectsEnabled,
  isWorkflowRepairEnabled,
  isWorkflowWorkerEnabled,
} from '@/config/workflow-backend'
import type { PilotCheckResult } from '@/lib/platform/pilot/types'

function guardCheck(id: string, label: string, enabled: boolean, note: string): PilotCheckResult {
  return {
    id,
    label,
    evidenceKind: 'BACKEND_FLAG',
    status: enabled ? 'FAIL' : 'PASS',
    summary: enabled
      ? `${label} is ON in this process — not allowed for default staging acceptance baseline`
      : `${label} OFF (source-default safe)`,
    detail: note,
  }
}

/** Static guardrail checks for AI + AUTO-10 execution boundaries (current process env). */
export function assessReleaseExecutionGuardrails(): PilotCheckResult[] {
  return [
    guardCheck('flag.customer_ai_workforce', 'CUSTOMER_AI_WORKFORCE_ENABLED', isCustomerAiWorkforceEnabled(), 'Batch 36–37 prep APIs'),
    guardCheck('flag.customer_ai_execution', 'CUSTOMER_AI_EXECUTION_ENABLED', isCustomerAiExecutionEnabled(), 'Live LLM / agent runtime'),
    guardCheck('flag.customer_ai_outbound', 'CUSTOMER_AI_OUTBOUND_ENABLED', isCustomerAiOutboundEnabled(), 'Customer messaging from AI'),
    guardCheck('flag.customer_ai_pilot_prep', 'CUSTOMER_AI_PILOT_PREP_ENABLED', isCustomerAiPilotPrepEnabled(), 'Pilot task preparation'),
    guardCheck('flag.customer_ai_pilot_durable', 'CUSTOMER_AI_PILOT_DURABLE_ENABLED', isCustomerAiPilotDurableEnabled(), 'PostgreSQL pilot task store'),
    guardCheck('flag.customer_ai_pilot_http', 'CUSTOMER_AI_PILOT_HTTP_ENABLED', isCustomerAiPilotHttpEnabled(), 'Pilot HTTP routes'),
    guardCheck(
      'flag.customer_ai_pilot_workflow_enqueue',
      'CUSTOMER_AI_PILOT_WORKFLOW_ENQUEUE_ENABLED',
      isCustomerAiPilotWorkflowEnqueueEnabled(),
      'AUTO-10 enqueue after pilot prepare',
    ),
    guardCheck('flag.customer_ai_chatwoot', 'CUSTOMER_AI_CHATWOOT_ADAPTER_ENABLED', isCustomerAiChatwootAdapterEnabled(), 'Chatwoot adapter'),
    guardCheck('flag.workflow_backend', 'WORKFLOW_BACKEND_ENABLED', isWorkflowBackendEnabled(), 'AUTO-10 durable backend'),
    guardCheck('flag.workflow_enqueue', 'WORKFLOW_ENQUEUE_ENABLED', isWorkflowEnqueueEnabled(), 'Workflow job enqueue'),
    guardCheck('flag.workflow_worker', 'WORKFLOW_WORKER_ENABLED', isWorkflowWorkerEnabled(), 'Workflow worker cron/API'),
    guardCheck('flag.workflow_repair', 'WORKFLOW_REPAIR_ENABLED', isWorkflowRepairEnabled(), 'Workflow repair hooks'),
    guardCheck(
      'flag.workflow_external_effects',
      'WORKFLOW_EXTERNAL_EFFECTS_ENABLED',
      isWorkflowExternalEffectsEnabled(),
      'External side effects from workflow handlers',
    ),
  ]
}

/** Repository surfaces that enforce CustomerAccount tenant + BillingGroup sibling denial (read-only inventory). */
export const TENANT_ISOLATION_MODULE_PATHS = [
  'lib/platform/crm/account-isolation.ts',
  'lib/platform/marketing/account-isolation.ts',
  'lib/platform/seo/account-isolation.ts',
  'lib/platform/comms/account-isolation.ts',
  'lib/platform/analytics/account-isolation.ts',
  'lib/platform/customer-ai-workforce/account-isolation.ts',
  'lib/platform/commerce/financial-boundaries.ts',
] as const

/** Human approval / version-bound workflow surfaces (not production activation). */
export const APPROVAL_BOUNDARY_PATHS = [
  'lib/platform/customer-ai-workforce/pilot-approval-service.ts',
  'app/api/v1/customer-ai/accounts/[accountId]/pilot-tasks/[taskId]/approvals/route.ts',
  'docs/platform/docs/BATCH36-CUSTOMER-AI-PILOT-V1.md',
] as const
