import type { AiToolDefinition } from '@/lib/platform/ai-tools/types'

export const AI_TOOL_REGISTRY: AiToolDefinition[] = [
  { name: 'projects.readMilestones', domain: 'projects', riskLevel: 0, approvalPolicy: 'NONE', enabled: true },
  { name: 'projects.proposeUpdate', domain: 'projects', riskLevel: 1, approvalPolicy: 'REQUIRED', enabled: true },
  { name: 'sites.scan', domain: 'sites', riskLevel: 0, approvalPolicy: 'NONE', enabled: true },
  { name: 'sites.proposeChange', domain: 'sites', riskLevel: 1, approvalPolicy: 'REQUIRED', enabled: true },
  { name: 'crm.contacts.search', domain: 'crm', riskLevel: 0, approvalPolicy: 'NONE', enabled: true },
  { name: 'crm.tasks.create', domain: 'crm', riskLevel: 1, approvalPolicy: 'REQUIRED', enabled: true },
  { name: 'communications.draft', domain: 'communications', riskLevel: 1, approvalPolicy: 'REQUIRED', enabled: true },
  {
    name: 'communications.requestApproval',
    domain: 'communications',
    riskLevel: 2,
    approvalPolicy: 'REQUIRED',
    enabled: true,
  },
  { name: 'marketing.createDraft', domain: 'marketing', riskLevel: 1, approvalPolicy: 'REQUIRED', enabled: true },
  { name: 'social.createDraft', domain: 'social', riskLevel: 1, approvalPolicy: 'REQUIRED', enabled: true },
  { name: 'social.requestSchedulingApproval', domain: 'social', riskLevel: 2, approvalPolicy: 'REQUIRED', enabled: true },
  { name: 'seo.readSnapshot', domain: 'seo', riskLevel: 0, approvalPolicy: 'NONE', enabled: true },
  { name: 'seo.prepareFixProposal', domain: 'seo', riskLevel: 1, approvalPolicy: 'REQUIRED', enabled: true },
  { name: 'hosting.readStatus', domain: 'hosting', riskLevel: 0, approvalPolicy: 'NONE', enabled: true },
  { name: 'marketplace.prepareQuote', domain: 'marketplace', riskLevel: 1, approvalPolicy: 'REQUIRED', enabled: true },
  { name: 'wallet.readAuthorizedBalance', domain: 'billing', riskLevel: 0, approvalPolicy: 'NONE', enabled: true },
  { name: 'commerce.prepareQuote', domain: 'billing', riskLevel: 1, approvalPolicy: 'REQUIRED', enabled: true },
  { name: 'db.rawQuery', domain: 'forbidden', riskLevel: 4, approvalPolicy: 'ALWAYS_DENY', enabled: false },
  { name: 'provider.unrestrictedKeys', domain: 'forbidden', riskLevel: 4, approvalPolicy: 'ALWAYS_DENY', enabled: false },
  { name: 'payments.charge', domain: 'forbidden', riskLevel: 4, approvalPolicy: 'ALWAYS_DENY', enabled: false },
  { name: 'messages.sendLive', domain: 'forbidden', riskLevel: 4, approvalPolicy: 'ALWAYS_DENY', enabled: false },
  { name: 'deploy.production', domain: 'forbidden', riskLevel: 4, approvalPolicy: 'ALWAYS_DENY', enabled: false },
  { name: 'clinical.readPhi', domain: 'forbidden', riskLevel: 4, approvalPolicy: 'ALWAYS_DENY', enabled: false },
]

export function getAiTool(name: string): AiToolDefinition | undefined {
  return AI_TOOL_REGISTRY.find((tool) => tool.name === name)
}
