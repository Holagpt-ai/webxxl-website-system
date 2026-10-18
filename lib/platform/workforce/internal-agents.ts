import type { InternalAgentDefinitionRecord } from '@/lib/platform/workforce/types'

export const INTERNAL_AGENT_KEYS = {
  projectManager: 'internal_agent_project_manager_v1',
  engineer: 'internal_agent_engineer_v1',
  qaReviewer: 'internal_agent_qa_reviewer_v1',
  documentation: 'internal_agent_documentation_v1',
  operations: 'internal_agent_operations_v1',
} as const

const sharedDenied = [
  'deploy.production',
  'payments.charge',
  'messages.sendLive',
  'db.rawQuery',
  'provider.unrestrictedKeys',
  'clinical.readPhi',
  'pause.self',
]

export const INTERNAL_AGENT_DEFINITIONS: InternalAgentDefinitionRecord[] = [
  {
    id: INTERNAL_AGENT_KEYS.projectManager,
    roleKey: 'project_manager',
    displayName: 'Project Manager Agent',
    configVersion: '1.0.0',
    riskTier: 1,
    providerAdapterKey: 'synthetic',
    liveExecutionEnabled: false,
    paused: true,
    allowedToolKeys: [
      'projects.readMilestones',
      'projects.proposeUpdate',
      'crm.tasks.create',
      'hosting.readStatus',
    ],
    deniedActions: [...sharedDenied, 'sites.proposeChange'],
    budgetLimitSubunits: 5000,
    maxConcurrency: 2,
  },
  {
    id: INTERNAL_AGENT_KEYS.engineer,
    roleKey: 'engineer',
    displayName: 'Engineer Agent',
    configVersion: '1.0.0',
    riskTier: 2,
    providerAdapterKey: 'synthetic',
    liveExecutionEnabled: false,
    paused: true,
    allowedToolKeys: ['projects.readMilestones', 'projects.proposeUpdate', 'sites.proposeChange'],
    deniedActions: sharedDenied,
    budgetLimitSubunits: 8000,
    maxConcurrency: 1,
  },
  {
    id: INTERNAL_AGENT_KEYS.qaReviewer,
    roleKey: 'qa_reviewer',
    displayName: 'QA Reviewer Agent',
    configVersion: '1.0.0',
    riskTier: 1,
    providerAdapterKey: 'synthetic',
    liveExecutionEnabled: false,
    paused: true,
    allowedToolKeys: ['projects.readMilestones', 'seo.readSnapshot', 'hosting.readStatus'],
    deniedActions: sharedDenied,
    budgetLimitSubunits: 4000,
    maxConcurrency: 2,
  },
  {
    id: INTERNAL_AGENT_KEYS.documentation,
    roleKey: 'documentation',
    displayName: 'Documentation Agent',
    configVersion: '1.0.0',
    riskTier: 0,
    providerAdapterKey: 'synthetic',
    liveExecutionEnabled: false,
    paused: true,
    allowedToolKeys: ['projects.readMilestones', 'seo.prepareFixProposal'],
    deniedActions: sharedDenied,
    budgetLimitSubunits: 3000,
    maxConcurrency: 2,
  },
  {
    id: INTERNAL_AGENT_KEYS.operations,
    roleKey: 'operations',
    displayName: 'Operations Agent',
    configVersion: '1.0.0',
    riskTier: 1,
    providerAdapterKey: 'synthetic',
    liveExecutionEnabled: false,
    paused: true,
    allowedToolKeys: ['hosting.readStatus', 'wallet.readAuthorizedBalance'],
    deniedActions: [...sharedDenied, 'deploy.production'],
    budgetLimitSubunits: 3000,
    maxConcurrency: 1,
  },
]

export function getInternalAgentDefinition(key: string): InternalAgentDefinitionRecord | undefined {
  return INTERNAL_AGENT_DEFINITIONS.find((d) => d.id === key || d.roleKey === key)
}
