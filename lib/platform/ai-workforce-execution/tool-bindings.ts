import { getAiTool, AI_TOOL_REGISTRY } from '@/lib/platform/ai-tools/registry'
import type { AiToolDefinition } from '@/lib/platform/ai-tools/types'
import {
  getCustomerAiTool,
  CUSTOMER_AI_TOOL_CATALOG,
} from '@/lib/platform/customer-ai-workforce/tool-catalog'
import type {
  AiWorkforceCoverageState,
  AiWorkforceDomain,
  AiWorkforceEffect,
  AiWorkforceLocale,
  PrepareAccountWorkforceActionInput,
} from '@/lib/platform/ai-workforce-execution/types'

export type ComposedToolBinding = {
  toolKey: string
  domain: AiWorkforceDomain
  effect: AiWorkforceEffect
  sourceModule: string
  denialReason?: string
}

type DraftContext = PrepareAccountWorkforceActionInput & {
  locale: AiWorkforceLocale
  serverChannelCoverage: AiWorkforceCoverageState
}

const COMPOSED: Record<
  string,
  {
    domain: AiWorkforceDomain
    effect: Exclude<AiWorkforceEffect, 'DENIED'>
    sourceModule: string
    compose: (input: DraftContext) => { coverageState: AiWorkforceCoverageState; draft: Record<string, unknown> }
  }
> = {
  'crm.contacts.search': {
    domain: 'crm',
    effect: 'READ',
    sourceModule: 'lib/platform/ai-tools/registry.ts',
    compose: crmDraft,
  },
  'crm.tasks.create': {
    domain: 'crm',
    effect: 'DRAFT',
    sourceModule: 'lib/platform/ai-tools/registry.ts',
    compose: crmDraft,
  },
  'customerAi.crm.contacts.read': {
    domain: 'crm',
    effect: 'READ',
    sourceModule: 'lib/platform/customer-ai-workforce/tool-catalog.ts',
    compose: crmDraft,
  },
  'projects.readMilestones': {
    domain: 'projects',
    effect: 'READ',
    sourceModule: 'lib/platform/workforce/internal-agents.ts',
    compose: projectDraft,
  },
  'projects.proposeUpdate': {
    domain: 'projects',
    effect: 'DRAFT',
    sourceModule: 'lib/platform/workforce/internal-agents.ts',
    compose: projectDraft,
  },
  'marketing.createDraft': {
    domain: 'marketing',
    effect: 'DRAFT',
    sourceModule: 'lib/platform/ai-tools/registry.ts',
    compose: marketingDraft,
  },
  'seo.readSnapshot': {
    domain: 'seo',
    effect: 'READ',
    sourceModule: 'lib/platform/workflow/handlers/seo-sync-prepare.ts',
    compose: seoDraft,
  },
  'seo.prepareFixProposal': {
    domain: 'seo',
    effect: 'DRAFT',
    sourceModule: 'lib/platform/workflow/handlers/seo-sync-prepare.ts',
    compose: seoDraft,
  },
  'communications.draft': {
    domain: 'communications',
    effect: 'DRAFT',
    sourceModule: 'lib/platform/comms-execution/guarded-prepare-service.ts',
    compose: communicationsDraft,
  },
  'communications.requestApproval': {
    domain: 'communications',
    effect: 'DRAFT',
    sourceModule: 'lib/platform/comms-execution/guarded-prepare-service.ts',
    compose: communicationsDraft,
  },
  'customerAi.chatwoot.handoff.request': {
    domain: 'communications',
    effect: 'DRAFT',
    sourceModule: 'lib/platform/customer-ai-workforce/pilot-workflows.ts',
    compose: communicationsDraft,
  },
  'customerAi.knowledge.retrieve': {
    domain: 'knowledge',
    effect: 'READ',
    sourceModule: 'lib/platform/customer-ai-workforce/retrieval-contract.ts',
    compose: knowledgeDraft,
  },
  'commerce.prepareQuote': {
    domain: 'billing',
    effect: 'DRAFT',
    sourceModule: 'lib/platform/ai-tools/registry.ts',
    compose: quoteDraft,
  },
}

function sourceIds(input: DraftContext): string[] {
  return [...(input.sourceRecordIds ?? [])].sort()
}

function crmDraft(input: DraftContext): { coverageState: AiWorkforceCoverageState; draft: Record<string, unknown> } {
  const coverageState = input.serverChannelCoverage
  return {
    coverageState,
    draft: {
      sourceModule: 'lib/platform/customer-ai-workforce/pilot-workflows.ts',
      toolKey: input.toolKey,
      sourceRecordIds: sourceIds(input),
      outboundSend: false,
      coverageState,
      synthesis: 'DETERMINISTIC_TEMPLATE',
      verifiedSourceRecords: sourceIds(input).length > 0,
      coverageNote:
        coverageState === 'CHANNEL_DISCONNECTED'
          ? 'Channel disconnected. This is a coverage limitation, not proof the lead was never contacted.'
          : 'Deterministic CRM preparation. Authoritative contact reads stay on existing CRM APIs. Connectivity is server-resolved or COVERAGE_UNVERIFIED.',
      suggestedAction: input.toolKey === 'crm.tasks.create' ? 'crm_task_draft' : 'crm_contact_summary',
      locale: input.locale,
    },
  }
}

function projectDraft(input: DraftContext): { coverageState: AiWorkforceCoverageState; draft: Record<string, unknown> } {
  return {
    coverageState: 'PROPOSAL_ONLY',
    draft: {
      sourceModule: 'lib/platform/workforce/internal-agents.ts',
      toolKey: input.toolKey,
      sourceRecordIds: sourceIds(input),
      managedSiteId: input.managedSiteId ?? null,
      deploy: false,
      dnsCutover: false,
      proposalOnly: input.toolKey === 'projects.proposeUpdate',
      locale: input.locale,
    },
  }
}

function marketingDraft(input: DraftContext): { coverageState: AiWorkforceCoverageState; draft: Record<string, unknown> } {
  return {
    coverageState: 'APPROVAL_REQUIRED',
    draft: {
      sourceModule: 'lib/platform/ai-tools/registry.ts',
      toolKey: input.toolKey,
      generation: 'DETERMINISTIC_DRAFT',
      publish: false,
      paidGeneration: false,
      locale: input.locale,
    },
  }
}

function seoDraft(input: DraftContext): { coverageState: AiWorkforceCoverageState; draft: Record<string, unknown> } {
  return {
    coverageState: 'STORED_OR_UNVERIFIED',
    draft: {
      sourceModule: 'lib/platform/workflow/handlers/seo-sync-prepare.ts',
      toolKey: input.toolKey,
      managedSiteId: input.managedSiteId ?? null,
      authoritative: false,
      liveFetch: false,
      locale: input.locale,
    },
  }
}

function communicationsDraft(input: DraftContext): {
  coverageState: AiWorkforceCoverageState
  draft: Record<string, unknown>
} {
  return {
    coverageState: 'DISPATCH_BLOCKED',
    draft: {
      sourceModule: 'lib/platform/comms-execution/guarded-prepare-service.ts',
      toolKey: input.toolKey,
      dispatch: 'BLOCKED',
      send: false,
      locale: input.locale,
    },
  }
}

function knowledgeDraft(input: DraftContext): { coverageState: AiWorkforceCoverageState; draft: Record<string, unknown> } {
  return {
    coverageState: 'APPROVED_SCOPE_ONLY',
    draft: {
      sourceModule: 'lib/platform/customer-ai-workforce/retrieval-contract.ts',
      toolKey: input.toolKey,
      executionEnabled: false,
      allowedClassification: 'GENERAL_BUSINESS',
      locale: input.locale,
    },
  }
}

function quoteDraft(input: DraftContext): { coverageState: AiWorkforceCoverageState; draft: Record<string, unknown> } {
  return {
    coverageState: 'QUOTE_ONLY',
    draft: {
      sourceModule: 'lib/platform/ai-tools/registry.ts',
      toolKey: input.toolKey,
      charge: false,
      customerChargeUsd: 0,
      locale: input.locale,
    },
  }
}

function registryDenial(tool: AiToolDefinition | undefined): string | null {
  if (!tool) return null
  if (!tool.enabled || tool.approvalPolicy === 'ALWAYS_DENY' || tool.riskLevel === 4) {
    return 'DENY_BY_DEFAULT'
  }
  return null
}

export function resolveComposedTool(toolKey: string): ComposedToolBinding {
  const customerTool = getCustomerAiTool(toolKey)
  if (customerTool?.alwaysDeny) {
    return {
      toolKey,
      domain: 'forbidden',
      effect: 'DENIED',
      sourceModule: 'lib/platform/customer-ai-workforce/tool-catalog.ts',
      denialReason: 'DENY_BY_DEFAULT',
    }
  }
  const registryTool = getAiTool(toolKey)
  const registryBlock = registryDenial(registryTool)
  if (registryBlock) {
    return {
      toolKey,
      domain: 'forbidden',
      effect: 'DENIED',
      sourceModule: 'lib/platform/ai-tools/registry.ts',
      denialReason: registryBlock,
    }
  }
  const composed = COMPOSED[toolKey]
  if (!composed) {
    if (registryTool || customerTool) {
      return {
        toolKey,
        domain: 'other',
        effect: 'DENIED',
        sourceModule: registryTool
          ? 'lib/platform/ai-tools/registry.ts'
          : 'lib/platform/customer-ai-workforce/tool-catalog.ts',
        denialReason: 'NOT_IN_BATCH6_SCOPE',
      }
    }
    return {
      toolKey,
      domain: 'forbidden',
      effect: 'DENIED',
      sourceModule: 'lib/platform/ai-workforce-execution/tool-bindings.ts',
      denialReason: 'UNKNOWN_TOOL',
    }
  }
  return {
    toolKey,
    domain: composed.domain,
    effect: composed.effect,
    sourceModule: composed.sourceModule,
  }
}

export function composeToolDraft(
  toolKey: string,
  input: DraftContext,
): { coverageState: AiWorkforceCoverageState; draft: Record<string, unknown> } | null {
  const composed = COMPOSED[toolKey]
  if (!composed) return null
  return composed.compose(input)
}

export type ToolCoverageRow = {
  toolKey: string
  domain: string
  effect: AiWorkforceEffect | 'REGISTRY_ONLY' | 'DISABLED'
  enabled: boolean
  batch6Composed: boolean
}

export function listToolCoverage(): ToolCoverageRow[] {
  const rows: ToolCoverageRow[] = []
  for (const tool of AI_TOOL_REGISTRY) {
    const binding = resolveComposedTool(tool.name)
    rows.push({
      toolKey: tool.name,
      domain: tool.domain,
      effect: !tool.enabled
        ? 'DISABLED'
        : binding.effect === 'DENIED' && binding.denialReason === 'NOT_IN_BATCH6_SCOPE'
          ? 'REGISTRY_ONLY'
          : binding.effect,
      enabled: tool.enabled,
      batch6Composed: Boolean(COMPOSED[tool.name]),
    })
  }
  for (const tool of CUSTOMER_AI_TOOL_CATALOG) {
    if (rows.some((row) => row.toolKey === tool.toolKey)) continue
    const binding = resolveComposedTool(tool.toolKey)
    rows.push({
      toolKey: tool.toolKey,
      domain: tool.domain,
      effect: binding.effect,
      enabled: !tool.alwaysDeny,
      batch6Composed: Boolean(COMPOSED[tool.toolKey]),
    })
  }
  return rows
}
