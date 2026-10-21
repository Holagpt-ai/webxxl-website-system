import {
  isCustomerAiChatwootAdapterEnabled,
  isCustomerAiExecutionEnabled,
  isCustomerAiOutboundEnabled,
  isCustomerAiWorkforceEnabled,
} from '@/config/customer-ai-workforce'
import { getCustomerAiTool } from '@/lib/platform/customer-ai-workforce/tool-catalog'
import type { CustomerAiResult, ToolAccessMode } from '@/lib/platform/customer-ai-workforce/types'
import type { CustomerAiStore } from '@/lib/platform/customer-ai-workforce/store'

export type AuthorizeCustomerAiToolInput = {
  employeeId: string
  customerAccountId: string
  toolKey: string
  accessMode: ToolAccessMode
  dataClassification?: string
}

export async function authorizeCustomerAiToolCall(
  store: CustomerAiStore,
  input: AuthorizeCustomerAiToolInput,
): Promise<CustomerAiResult<{ allowed: true; auditRef: string }>> {
  if (!isCustomerAiWorkforceEnabled()) {
    return { ok: false, error: 'AI_WORKFORCE_DISABLED', message: 'Customer AI workforce disabled' }
  }
  const policy = await store.getUsagePolicy(input.customerAccountId)
  if (policy?.emergencyDisabled) {
    return { ok: false, error: 'EMERGENCY_DISABLED', message: 'Account emergency disable is active' }
  }
  if (!isCustomerAiExecutionEnabled() || !policy?.executionEnabled) {
    return { ok: false, error: 'EXECUTION_DISABLED', message: 'AI execution remains disabled' }
  }

  const tool = getCustomerAiTool(input.toolKey)
  if (!tool) return { ok: false, error: 'VALIDATION', message: 'Unknown tool' }
  if (tool.alwaysDeny) return { ok: false, error: 'POLICY_BLOCKED', message: 'Tool permanently denied' }
  if (tool.requiresWriteMode && input.accessMode !== 'WRITE') {
    return { ok: false, error: 'FORBIDDEN', message: 'Write access required' }
  }
  if (input.dataClassification === 'REGULATED_HEALTHCARE' && input.toolKey.includes('crm')) {
    return { ok: false, error: 'POLICY_BLOCKED', message: 'Healthcare boundary' }
  }

  const employee = await store.findEmployeeById(input.employeeId)
  if (!employee || employee.customerAccountId !== input.customerAccountId) {
    return { ok: false, error: 'TENANT_MISMATCH', message: 'Employee scope mismatch' }
  }
  if (employee.emergencyPaused || employee.status !== 'ACTIVE') {
    return { ok: false, error: 'EXECUTION_DISABLED', message: 'Employee not active' }
  }

  const perm = await store.findToolPermission(input.employeeId, input.toolKey, input.accessMode)
  if (!perm?.granted) {
    await store.incrementToolDenial(input.employeeId, input.customerAccountId)
    return { ok: false, error: 'FORBIDDEN', message: 'Tool not granted' }
  }

  if (input.toolKey.includes('chatwoot') && !isCustomerAiChatwootAdapterEnabled()) {
    return { ok: false, error: 'EXECUTION_DISABLED', message: 'Chatwoot adapter disabled' }
  }
  if (input.toolKey.includes('sendLive') || input.toolKey === 'customerAi.messages.sendLive') {
    if (!isCustomerAiOutboundEnabled()) {
      return { ok: false, error: 'EXECUTION_DISABLED', message: 'Outbound messaging disabled' }
    }
  }

  await store.incrementToolAllowance(input.employeeId, input.customerAccountId)
  return { ok: true, value: { allowed: true, auditRef: `tool_auth_${input.toolKey}` } }
}
