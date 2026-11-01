import type { CustomerAiPilotTrustedDataSource, CustomerAiPilotWorkflowKind } from '@/lib/platform/customer-ai-workforce/pilot-types'
import { filterPilotReceptionistKnowledge } from '@/lib/platform/customer-ai-workforce/pilot-knowledge-scope'
import type { CustomerAiStore } from '@/lib/platform/customer-ai-workforce/store'
import { getCustomerAiTool } from '@/lib/platform/customer-ai-workforce/tool-catalog'

export type PilotWorkflowContext = {
  locale: string
  managedSiteId: string | null
  trustedDataSource: CustomerAiPilotTrustedDataSource
  /** Test-only synthetic CRM/SEO fixture; ignored unless trustedDataSource is TEST_SYNTHETIC. */
  testSyntheticSnapshot?: Record<string, unknown>
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
      if (input.context.trustedDataSource !== 'TEST_SYNTHETIC') {
        return {
          toolKey,
          accessMode,
          requiresHumanApproval: false,
          estimatedCostUnits: null,
          draftPayload: {
            outcome: 'UNVERIFIED',
            reason: 'Authoritative CRM lead retrieval is not available on the server boundary',
            authoritativeFindingsBlocked: true,
          },
          outcomeHint: 'UNVERIFIED',
        }
      }
      const snapshot = input.context.testSyntheticSnapshot ?? {}
      const leads = Array.isArray(snapshot.leads) ? (snapshot.leads as Array<Record<string, unknown>>) : []
      const channelConnected = snapshot.smsChannelConnected === true
      const missingFollowUps = leads.filter((l) => l.needsFollowUp === true)
      const disconnectedCoverage = !channelConnected ? leads.filter((l) => l.lastTouchChannel === 'sms') : []
      const draftPayload = {
        dataLabel: 'TEST_SYNTHETIC_ONLY',
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
      const recommendations = [
        {
          kind: 'deterministic_test_recommendation',
          title: 'Review top landing page meta descriptions',
          priority: 'medium',
          marketingStudioApprovalRequired: true,
        },
      ]
      const draftPayload = {
        seoSnapshotRef: input.context.managedSiteId,
        seoAuthoritative: false,
        recommendations,
        draftProposal: input.prepareConsequentialDraft
          ? {
              type: 'marketing_studio_draft',
              title: 'Pilot SEO content refresh proposal',
              publishBlocked: true,
            }
          : null,
      }
      const outcomeHint =
        input.context.trustedDataSource === 'TEST_SYNTHETIC' || input.context.trustedDataSource === 'SERVER'
          ? input.prepareConsequentialDraft
            ? 'PENDING_APPROVAL'
            : 'PREPARED'
          : 'UNVERIFIED'
      return {
        toolKey,
        accessMode,
        requiresHumanApproval: input.prepareConsequentialDraft,
        estimatedCostUnits: input.prepareConsequentialDraft ? 15 : 2,
        draftPayload,
        outcomeHint,
      }
    }
    case 'receptionist_preparation': {
      const published = await store.listPublishedKnowledge(input.customerAccountId, input.context.locale)
      const { items, siteRestrictedOmitted, unverifiedSiteScope } = filterPilotReceptionistKnowledge(
        published,
        input.context.managedSiteId,
      )
      if (items.length === 0 && (siteRestrictedOmitted > 0 || unverifiedSiteScope)) {
        return {
          toolKey,
          accessMode,
          requiresHumanApproval: false,
          estimatedCostUnits: null,
          draftPayload: {
            outcome: 'UNVERIFIED',
            reason: 'Site-restricted knowledge cannot be verified without site ownership binding',
            siteRestrictedOmitted,
          },
          outcomeHint: 'UNVERIFIED',
        }
      }
      const faqExcerpt = items.slice(0, 3).map((p) => ({
        knowledgePublicId: p.publicId,
        title: p.title,
        languageTag: p.languageTag,
        classification: p.classification,
      }))
      const draftPayload = {
        locale: input.context.locale,
        approvedFaqRefs: faqExcerpt,
        siteRestrictedOmitted,
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
