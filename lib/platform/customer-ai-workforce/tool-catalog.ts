import type { ToolAccessMode } from '@/lib/platform/customer-ai-workforce/types'

export type CustomerAiToolDefinition = {
  toolKey: string
  label: string
  domain: string
  defaultAccessMode: ToolAccessMode
  /** When true, grant is always denied (healthcare / forbidden). */
  alwaysDeny: boolean
  requiresWriteMode: boolean
}

/** Deny-by-default catalog for customer AI employees (explicit grants only). */
export const CUSTOMER_AI_TOOL_CATALOG: CustomerAiToolDefinition[] = [
  { toolKey: 'customerAi.crm.contacts.read', label: 'CRM contact lookup', domain: 'crm', defaultAccessMode: 'READ', alwaysDeny: false, requiresWriteMode: false },
  { toolKey: 'customerAi.crm.leads.qualify', label: 'Lead qualification', domain: 'crm', defaultAccessMode: 'WRITE', alwaysDeny: false, requiresWriteMode: true },
  { toolKey: 'customerAi.support.ticket.create', label: 'Support ticket create', domain: 'support', defaultAccessMode: 'WRITE', alwaysDeny: false, requiresWriteMode: true },
  { toolKey: 'customerAi.chatwoot.conversation.read', label: 'Chatwoot conversation read', domain: 'communications', defaultAccessMode: 'READ', alwaysDeny: false, requiresWriteMode: false },
  { toolKey: 'customerAi.chatwoot.handoff.request', label: 'Chatwoot human handoff', domain: 'communications', defaultAccessMode: 'WRITE', alwaysDeny: false, requiresWriteMode: true },
  { toolKey: 'customerAi.scheduling.appointment.request', label: 'Appointment request', domain: 'scheduling', defaultAccessMode: 'WRITE', alwaysDeny: false, requiresWriteMode: true },
  { toolKey: 'customerAi.knowledge.retrieve', label: 'Approved knowledge retrieval', domain: 'knowledge', defaultAccessMode: 'READ', alwaysDeny: false, requiresWriteMode: false },
  { toolKey: 'customerAi.workflow.request', label: 'Internal workflow request', domain: 'workflow', defaultAccessMode: 'WRITE', alwaysDeny: false, requiresWriteMode: true },
  { toolKey: 'customerAi.clinical.readPhi', label: 'Regulated clinical read', domain: 'forbidden', defaultAccessMode: 'READ', alwaysDeny: true, requiresWriteMode: false },
  { toolKey: 'customerAi.db.rawQuery', label: 'Raw database query', domain: 'forbidden', defaultAccessMode: 'WRITE', alwaysDeny: true, requiresWriteMode: true },
  { toolKey: 'customerAi.messages.sendLive', label: 'Live outbound message', domain: 'forbidden', defaultAccessMode: 'WRITE', alwaysDeny: true, requiresWriteMode: true },
]

export function getCustomerAiTool(toolKey: string): CustomerAiToolDefinition | undefined {
  return CUSTOMER_AI_TOOL_CATALOG.find((t) => t.toolKey === toolKey)
}

export function listCustomerAiToolCatalog(): CustomerAiToolDefinition[] {
  return CUSTOMER_AI_TOOL_CATALOG
}
