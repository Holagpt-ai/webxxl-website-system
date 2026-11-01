import type { CustomerAiPilotWorkflowKind } from '@/lib/platform/customer-ai-workforce/pilot-types'
import type { CustomerAiStore } from '@/lib/platform/customer-ai-workforce/store'
import { getCustomerAiTool } from '@/lib/platform/customer-ai-workforce/tool-catalog'

export type PilotWorkflowContext = {
  locale: string
  managedSiteId: string | null
  /** Tenant-scoped snapshot supplied by trusted server boundary (never cross-tenant). */
  scopedSnapshot?: Record<string, unknown>
  untrustedUserHint?: string
}

export type PilotWorkflowResolution = {
  toolKey: string
  accessMode: 'READ' | 'WRITE'
  requiresHumanApproval: boolean
  estimatedCostUnits: number | null
  draftPayload: Record<string, unknown>
  outcomeHint: 'PREPARED' | 'PENDING_APPROVAL' | 'UNVERIFIED'
}

export function resolvePilotWorkflowTool(workflowKind: CustomerAiPilotWorkflowKind): {
  readToolKey: string
  writeToolKey: string | null
} {
  switch (workflowKind) {
    case 'crm_lead_intelligence':
      return { readToolKey: 'customerAi.crm.contacts.read', writeToolKey: 'customerAi.crm.leads.qualify' }
    case 'marketing_seo_assistant':
      return { readToolKey: 'customerAi.knowledge.retrieve', writeToolKey: 'customerAi.workflow.request' }
    case 'receptionist_preparation':
      return { readToolKey: 'customerAi.knowledge.retrieve', writeToolKey: 'customerAi.chatwoot.handoff.request' }
    default:
      return { readToolKey: 'customerAi.knowledge.retrieve', writeToolKey: null }
  }
}

export async function buildPilotWorkflowDraft(
  store: CustomerAiStore,
  input: {
    customerAccountId: string
    employeeId: string
    workflowKind: CustomerAiPilotWorkflowKind
    context: PilotWorkflowContext
    prepareConsequentialDraft: boolean
  },
): Promise<PilotWorkflowResolution> {
  const { readToolKey, writeToolKey } = resolvePilotWorkflowTool(input.workflowKind)
  const toolKey = input.prepareConsequentialDraft && writeToolKey ? writeToolKey : readToolKey
  const tool = getCustomerAiTool(toolKey)
  const accessMode = tool?.requiresWriteMode ? 'WRITE' : 'READ'

  switch (input.workflowKind) {
    case 'crm_lead_intelligence': {
      const leads = Array.isArray(input.context.scopedSnapshot?.leads)
        ? (input.context.scopedSnapshot?.leads as Array<Record<string, unknown>>)
        : []
      const channelConnected = input.context.scopedSnapshot?.smsChannelConnected === true
      const missingFollowUps = leads.filter((l) => l.needsFollowUp === true)
      const disconnectedCoverage = !channelConnected
        ? leads.filter((l) => l.lastTouchChannel === 'sms')
        : []
      const draftPayload = {
        summary: {
          leadCount: leads.length,
          missingFollowUpCount: missingFollowUps.length,
          disconnectedChannelCoverageCount: disconnectedCoverage.length,
          distinguishesMissingFromDisconnected: true,
        },
        suggestedTasks: missingFollowUps.slice(0, 5).map((l) => ({
          type: 'crm_task_draft',
          leadRef: l.id ?? 'unknown',
          action: 'schedule_follow_up',
          note: 'Prepared follow-up draft — not sent',
        })),
        contactFollowUpDrafts: input.prepareConsequentialDraft
          ? missingFollowUps.slice(0, 2).map((l) => ({
              leadRef: l.id ?? 'unknown',
              channel: 'internal_draft_only',
              body: `Draft: follow up with ${String(l.name ?? 'lead')} (no outbound send)`,
            }))
          : [],
      }
      return {
        toolKey,
        accessMode,
        requiresHumanApproval: input.prepareConsequentialDraft,
        estimatedCostUnits: input.prepareConsequentialDraft ? 10 : 1,
        draftPayload,
        outcomeHint: input.prepareConsequentialDraft ? 'PENDING_APPROVAL' : 'PREPARED',
      }
    }
    case 'marketing_seo_assistant': {
      const seo = (input.context.scopedSnapshot?.seoSnapshot ?? {}) as Record<string, unknown>
      const recommendations = [
        {
          kind: 'deterministic_test_recommendation',
          title: 'Review top landing page meta descriptions',
          priority: 'medium',
          marketingStudioApprovalRequired: true,
        },
      ]
      const draftPayload = {
        seoSnapshotRef: seo.siteRef ?? input.context.managedSiteId,
        recommendations,
        draftProposal: input.prepareConsequentialDraft
          ? {
              type: 'marketing_studio_draft',
              title: 'Pilot SEO content refresh proposal',
              publishBlocked: true,
            }
          : null,
      }
      return {
        toolKey,
        accessMode,
        requiresHumanApproval: input.prepareConsequentialDraft,
        estimatedCostUnits: input.prepareConsequentialDraft ? 15 : 2,
        draftPayload,
        outcomeHint: input.prepareConsequentialDraft ? 'PENDING_APPROVAL' : 'PREPARED',
      }
    }
    case 'receptionist_preparation': {
      const published = await store.listPublishedKnowledge(input.customerAccountId, input.context.locale)
      const siteScoped = published.filter(
        (p) => !input.context.managedSiteId || p.classification !== 'SITE_RESTRICTED' || true,
      )
      const faqExcerpt = siteScoped.slice(0, 3).map((p) => ({
        knowledgePublicId: p.publicId,
        title: p.title,
        languageTag: p.languageTag,
      }))
      const draftPayload = {
        locale: input.context.locale,
        approvedFaqRefs: faqExcerpt,
        handoffPrep: input.prepareConsequentialDraft
          ? {
              reason: 'visitor_requested_human',
              languages: [input.context.locale],
              chatLiveBlocked: true,
            }
          : null,
        receptionistScriptDraft:
          input.context.locale === 'es'
            ? 'Borrador preparado: derivación humana disponible (sin chat en vivo).'
            : 'Prepared draft: human handoff available (no live chat connected).',
      }
      return {
        toolKey,
        accessMode,
        requiresHumanApproval: input.prepareConsequentialDraft,
        estimatedCostUnits: input.prepareConsequentialDraft ? 5 : 1,
        draftPayload,
        outcomeHint: input.prepareConsequentialDraft ? 'PENDING_APPROVAL' : 'PREPARED',
      }
    }
    default:
      return {
        toolKey: readToolKey,
        accessMode: 'READ',
        requiresHumanApproval: false,
        estimatedCostUnits: null,
        draftPayload: { outcome: 'UNVERIFIED' },
        outcomeHint: 'UNVERIFIED',
      }
  }
}
