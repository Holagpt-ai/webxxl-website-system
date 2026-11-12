import {
  isCustomerAiExecutionEnabled,
  isCustomerAiOutboundEnabled,
  isCustomerAiPilotDurableEnabled,
  isCustomerAiPilotPrepEnabled,
  isCustomerAiWorkforceEnabled,
} from '@/config/customer-ai-workforce'
import {
  isAutonomousProductionActionsEnabled,
  isInternalWorkforceEnabled,
  isPaperclipExecutionEnabled,
  workforceGlobalBudgetSubunitsLimit,
} from '@/config/workforce'
import { isWorkflowExternalEffectsEnabled, isWorkflowWorkerEnabled } from '@/config/workflow-backend'
import { OPEN001_DECISION } from '@/lib/platform/open001/policy'
import { INTERNAL_AGENT_DEFINITIONS } from '@/lib/platform/workforce/internal-agents'
import {
  AI_WORKFORCE_ACCOUNT_HARD_CEILING_SUBUNITS,
  AI_WORKFORCE_ACCOUNT_SOFT_CEILING_SUBUNITS,
  AI_WORKFORCE_EXECUTION_BATCH_VERSION,
  AI_WORKFORCE_EXECUTION_DISCLOSURE,
  PAID_AI_EMPLOYEE_ENTITLEMENT_KEY,
} from '@/lib/platform/ai-workforce-execution/constants'
import { isAccountWorkforcePaused } from '@/lib/platform/ai-workforce-execution/orchestration'
import type { AiWorkforceOrchestrationStore } from '@/lib/platform/ai-workforce-execution/store'
import { listToolCoverage } from '@/lib/platform/ai-workforce-execution/tool-bindings'
import type { AiWorkforceExecutionSlice } from '@/lib/platform/ai-workforce-execution/types'
import { describeWorkflowHandoff } from '@/lib/platform/ai-workforce-execution/workflow-visibility'

export type AiWorkforceExecutionSummary = {
  version: typeof AI_WORKFORCE_EXECUTION_BATCH_VERSION
  customerAccountId: string
  managedSiteId: string | null
  disclosure: typeof AI_WORKFORCE_EXECUTION_DISCLOSURE
  runtimeGates: AiWorkforceExecutionSlice<{
    internalWorkforceEnabled: boolean
    paperclipExecutionEnabled: boolean
    autonomousProductionActions: boolean
    customerWorkforceEnabled: boolean
    customerExecutionEnabled: boolean
    customerOutboundEnabled: boolean
    pilotPrepEnabled: boolean
    durablePilotEnabled: boolean
    workflowWorkerEnabled: boolean
    workflowExternalEffectsEnabled: boolean
    liveInferenceBlocked: true
    outboundBlocked: true
    externalEffectsBlocked: true
  }>
  internalRoles: AiWorkforceExecutionSlice<{
    supervision: 'ON_DEMAND'
    schedulesEnabled: false
    autoMergeEnabled: false
    roles: Array<{ roleKey: string; liveExecutionEnabled: false; paused: true; budgetLimitSubunits: number | null }>
  }>
  toolCoverage: AiWorkforceExecutionSlice<{ rows: ReturnType<typeof listToolCoverage> }>
  costCeilings: AiWorkforceExecutionSlice<{
    customerChargeUsd: 0
    internalExpense: 'ESTIMATE_ONLY'
    globalLimitSubunits: number
    accountHardCeilingSubunits: number
    accountSoftCeilingSubunits: number
    silentPaidUpgrade: false
  }>
  pauseControls: AiWorkforceExecutionSlice<{ accountPaused: boolean; agentSelfPause: false }>
  workflowHandoff: AiWorkforceExecutionSlice<ReturnType<typeof describeWorkflowHandoff>>
  approvalBoundary: AiWorkforceExecutionSlice<{
    promptMayApprove: false
    open001Cohort: typeof OPEN001_DECISION.activeCohort
    includedMarketingAgents: 'FREE_SUBSCRIBER_ONLY'
    paidAiEmployeeSku: typeof PAID_AI_EMPLOYEE_ENTITLEMENT_KEY
    paidAiEmployeePurchasable: false
  }>
  billingIsolation: AiWorkforceExecutionSlice<{
    operationalTenant: 'CustomerAccount'
    billingGroupGrantsSiblingAiAccess: false
  }>
  customerEmployeePersistence: AiWorkforceExecutionSlice<{ persistence: 'NOT_READ' }>
}

function available<T>(sourceModule: string, data: T): AiWorkforceExecutionSlice<T> {
  return { status: 'AVAILABLE', sourceModule, data }
}

export function getAiWorkforceExecutionSummary(input: {
  customerAccountId: string
  managedSiteId?: string | null
  store?: AiWorkforceOrchestrationStore
}): AiWorkforceExecutionSummary {
  const executionOn = isCustomerAiExecutionEnabled()
  const outboundOn = isCustomerAiOutboundEnabled()
  const effectsOn = isWorkflowExternalEffectsEnabled()
  return {
    version: AI_WORKFORCE_EXECUTION_BATCH_VERSION,
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId ?? null,
    disclosure: AI_WORKFORCE_EXECUTION_DISCLOSURE,
    runtimeGates: available('config/customer-ai-workforce.ts', {
      internalWorkforceEnabled: isInternalWorkforceEnabled(),
      paperclipExecutionEnabled: isPaperclipExecutionEnabled(),
      autonomousProductionActions: isAutonomousProductionActionsEnabled(),
      customerWorkforceEnabled: isCustomerAiWorkforceEnabled(),
      customerExecutionEnabled: executionOn,
      customerOutboundEnabled: outboundOn,
      pilotPrepEnabled: isCustomerAiPilotPrepEnabled(),
      durablePilotEnabled: isCustomerAiPilotDurableEnabled(),
      workflowWorkerEnabled: isWorkflowWorkerEnabled(),
      workflowExternalEffectsEnabled: effectsOn,
      liveInferenceBlocked: true,
      outboundBlocked: true,
      externalEffectsBlocked: true,
    }),
    internalRoles: available('lib/platform/workforce/internal-agents.ts', {
      supervision: 'ON_DEMAND',
      schedulesEnabled: false,
      autoMergeEnabled: false,
      roles: INTERNAL_AGENT_DEFINITIONS.map((role) => ({
        roleKey: role.roleKey,
        liveExecutionEnabled: false as const,
        paused: true as const,
        budgetLimitSubunits: role.budgetLimitSubunits,
      })),
    }),
    toolCoverage: available('lib/platform/ai-workforce-execution/tool-bindings.ts', {
      rows: listToolCoverage(),
    }),
    costCeilings: available('config/workforce.ts', {
      customerChargeUsd: 0,
      internalExpense: 'ESTIMATE_ONLY',
      globalLimitSubunits: workforceGlobalBudgetSubunitsLimit(),
      accountHardCeilingSubunits: AI_WORKFORCE_ACCOUNT_HARD_CEILING_SUBUNITS,
      accountSoftCeilingSubunits: AI_WORKFORCE_ACCOUNT_SOFT_CEILING_SUBUNITS,
      silentPaidUpgrade: false,
    }),
    pauseControls: available('lib/platform/ai-workforce-execution/orchestration.ts', {
      accountPaused: input.store ? isAccountWorkforcePaused(input.store, input.customerAccountId) : false,
      agentSelfPause: false,
    }),
    workflowHandoff: available(
      'lib/platform/workflow/handlers/workforce-task-prepare.ts',
      describeWorkflowHandoff({ idempotencyKey: 'summary', actionHash: null }),
    ),
    approvalBoundary: available('lib/platform/open001/policy.ts', {
      promptMayApprove: false,
      open001Cohort: OPEN001_DECISION.activeCohort,
      includedMarketingAgents: 'FREE_SUBSCRIBER_ONLY',
      paidAiEmployeeSku: PAID_AI_EMPLOYEE_ENTITLEMENT_KEY,
      paidAiEmployeePurchasable: false,
    }),
    billingIsolation: available('lib/platform/customer-ai-workforce/account-isolation.ts', {
      operationalTenant: 'CustomerAccount',
      billingGroupGrantsSiblingAiAccess: false,
    }),
    customerEmployeePersistence: isCustomerAiWorkforceEnabled()
      ? {
          status: 'UNAVAILABLE',
          sourceModule: 'lib/platform/customer-ai-workforce/prisma-store.ts',
          reasonCode: 'READ_NOT_COMPOSED',
          message: 'Employee rows stay on existing customer AI APIs. This summary does not list them.',
        }
      : {
          status: 'UNAVAILABLE',
          sourceModule: 'config/customer-ai-workforce.ts',
          reasonCode: 'CUSTOMER_AI_WORKFORCE_DISABLED',
          message: 'Customer AI workforce persistence is disabled.',
        },
  }
}
