import {
  isCustomerAiChatwootAdapterEnabled,
  isCustomerAiExecutionEnabled,
  isCustomerAiOutboundEnabled,
  isCustomerAiWorkforceEnabled,
} from '@/config/customer-ai-workforce'
import type {
  ChatSessionStatus,
  EmployeeLifecycleStatus,
  HandoffStatus,
  KnowledgeStatus,
  ToolAccessMode,
} from '@/lib/platform/customer-ai-workforce/types'

export type CustomerAiFeatureFlagsDto = {
  workforceEnabled: boolean
  executionEnabled: boolean
  outboundEnabled: boolean
  chatwootAdapterEnabled: boolean
}

export function customerAiFeatureFlagsDto(): CustomerAiFeatureFlagsDto {
  return {
    workforceEnabled: isCustomerAiWorkforceEnabled(),
    executionEnabled: isCustomerAiExecutionEnabled(),
    outboundEnabled: isCustomerAiOutboundEnabled(),
    chatwootAdapterEnabled: isCustomerAiChatwootAdapterEnabled(),
  }
}

export type CustomerAiEmployeeDto = {
  id: string
  publicId: string
  customerAccountId: string
  managedSiteId: string | null
  projectId: string | null
  displayName: string
  roleTitle: string
  description: string | null
  config: Record<string, unknown>
  primaryLocale: string
  secondaryLocales: string[]
  status: EmployeeLifecycleStatus
  entitlementKey: string
  emergencyPaused: boolean
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export type CustomerAiKnowledgeItemDto = {
  id: string
  publicId: string
  customerAccountId: string
  kind: string
  status: KnowledgeStatus
  title: string
  summary: string | null
  languageTag: string
  classification: string
  currentRevisionNumber: number | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export type CustomerAiToolPermissionDto = {
  toolKey: string
  accessMode: ToolAccessMode
  granted: boolean
  grantedAt: string | null
}

export type CustomerAiChatSessionDto = {
  id: string
  publicId: string
  customerAccountId: string
  employeeId: string | null
  managedSiteId: string | null
  status: ChatSessionStatus
  visitorRef: string | null
  visitorLocale: string | null
  dataClassification: string
  lastMessageAt: string | null
  createdAt: string
  updatedAt: string
}

export type CustomerAiChatMessageDto = {
  id: string
  sessionId: string
  role: string
  bodyText: string
  idempotencyKey: string
  createdAt: string
}

export type CustomerAiHandoffDto = {
  id: string
  sessionId: string
  status: HandoffStatus
  reason: string | null
  assignedUserId: string | null
  createdAt: string
  updatedAt: string
}

export type CustomerAiUsagePolicyDto = {
  customerAccountId: string
  maxActiveEmployees: number
  monthlyMessageBudget: number | null
  monthlyTokenBudget: number | null
  rateLimitPerMinute: number
  executionEnabled: boolean
  emergencyDisabled: boolean
  activeEmployeeCount: number
  flags: CustomerAiFeatureFlagsDto
}

export type CustomerAiUsageSummaryDto = {
  customerAccountId: string
  periodKey: string
  employees: Array<{
    employeeId: string
    publicId: string
    messagesIngested: number
    tokensReserved: number
    toolCallsAuthorized: number
    toolCallsDenied: number
  }>
}
