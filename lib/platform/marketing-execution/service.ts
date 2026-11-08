import { prisma } from '@/lib/db'
import {
  isPostizApiEnabled,
  isPostizLivePublishingEnabled,
} from '@/config/social-marketing'
import type { PortalUser } from '@/lib/portal/authz'
import { isPrismaMissingTableError } from '@/lib/platform/business-overview/access'
import {
  listCrmSegmentsForAudiencePlanning,
  previewCrmSegmentAudience,
} from '@/lib/platform/marketing/crm-segment-audience-service'
import {
  MARKETING_EXECUTION_PLANNING_DISCLOSURE,
  MARKETING_EXECUTION_PROVENANCE_NOTICE,
} from '@/lib/platform/marketing-execution/constants'
import { loadMarketingReviewEvidence, loadMarketingWorkflowLifecycleCounts } from '@/lib/platform/marketing-execution/counts'
import {
  loadMarketingExecutionContext,
  resolveCrmAudiencePlanningSliceAccess,
  resolveMarketingExecutionCoreAccess,
  resolveSocialReadinessSliceAccess,
} from '@/lib/platform/marketing-execution/access'
import type {
  CrmAudiencePlanningSliceData,
  MarketingExecutionSlice,
  MarketingExecutionSummaryResponse,
} from '@/lib/platform/marketing-execution/types'
import { mapPostizReadinessForExecutionSummary } from '@/lib/platform/marketing-execution/postiz-readiness-summary'
import { buildPostizProviderReadiness } from '@/lib/platform/social/postiz-provider-readiness'

export type MarketingExecutionResult =
  | { ok: true; value: MarketingExecutionSummaryResponse }
  | { ok: false; code: 'NOT_FOUND'; message: string }

function unavailable<T>(
  sourceModule: MarketingExecutionSlice<T>['sourceModule'],
  reasonCode: string,
  message: string,
): MarketingExecutionSlice<T> {
  return { status: 'UNAVAILABLE', sourceModule, reasonCode, message }
}

async function resolveManagedSiteScope(
  customerAccountId: string,
  managedSiteId?: string | null,
): Promise<{ ok: true; managedSiteId: string | null } | { ok: false; message: string }> {
  if (!managedSiteId) return { ok: true, managedSiteId: null }
  const site = await prisma.managedSite.findFirst({
    where: { id: managedSiteId, customerAccountId },
    select: { id: true },
  })
  if (!site) {
    return { ok: false, message: 'Managed site not found for account' }
  }
  return { ok: true, managedSiteId: site.id }
}

export async function getMarketingExecutionSummary(input: {
  portal: PortalUser
  managedSiteId?: string | null
}): Promise<MarketingExecutionResult> {
  const now = new Date()
  const customerAccountId = input.portal.customerAccount.id
  const scope = await resolveManagedSiteScope(customerAccountId, input.managedSiteId)
  if (!scope.ok) {
    return { ok: false, code: 'NOT_FOUND', message: scope.message }
  }

  const ctx = await loadMarketingExecutionContext(input.portal)
  const coreBlocked = (() => {
    const coreAccess = resolveMarketingExecutionCoreAccess(ctx)
    if (coreAccess === 'proceed') return null
    if (coreAccess.state === 'available') return null
    return { reasonCode: coreAccess.reasonCode, message: coreAccess.message }
  })()

  let workflowCounts: MarketingExecutionSummaryResponse['workflowCounts'] = unavailable(
    'marketing.workflow_counts',
    'DATA_UNAVAILABLE',
    'Workflow counts are temporarily unavailable',
  )
  let reviewEvidence: MarketingExecutionSummaryResponse['reviewEvidence'] = unavailable(
    'marketing.review_evidence',
    'DATA_UNAVAILABLE',
    'Review evidence is temporarily unavailable',
  )

  if (coreBlocked) {
    workflowCounts = unavailable('marketing.workflow_counts', coreBlocked.reasonCode, coreBlocked.message)
    reviewEvidence = unavailable('marketing.review_evidence', coreBlocked.reasonCode, coreBlocked.message)
  } else {
    try {
      const [counts, evidence] = await Promise.all([
        loadMarketingWorkflowLifecycleCounts({
          customerAccountId,
          managedSiteId: scope.managedSiteId,
          now,
        }),
        loadMarketingReviewEvidence({
          customerAccountId,
          managedSiteId: scope.managedSiteId,
          now,
        }),
      ])
      workflowCounts = { status: 'AVAILABLE', sourceModule: 'marketing.workflow_counts', data: counts }
      reviewEvidence = {
        status: 'AVAILABLE',
        sourceModule: 'marketing.review_evidence',
        data: evidence,
      }
    } catch (error) {
      if (!isPrismaMissingTableError(error)) throw error
    }
  }

  let crmAudiencePlanning: MarketingExecutionSummaryResponse['crmAudiencePlanning'] = unavailable(
    'marketing.crm_audience_planning',
    'CRM_AUDIENCE_DISABLED',
    'CRM audience planning unavailable',
  )
  const crmBlocked = resolveCrmAudiencePlanningSliceAccess(ctx)
  if (crmBlocked) {
    crmAudiencePlanning = unavailable(
      'marketing.crm_audience_planning',
      crmBlocked.reasonCode,
      crmBlocked.message,
    )
  } else {
    try {
      const catalog = await listCrmSegmentsForAudiencePlanning(customerAccountId)
      let latestPreview: CrmAudiencePlanningSliceData['latestPreview'] = null

      if (catalog.ok && catalog.value.length > 0) {
        const firstEligible = catalog.value.find((row) => row.audiencePlanningEligible) ?? catalog.value[0]
        if (firstEligible) {
          const preview = await previewCrmSegmentAudience(customerAccountId, firstEligible.id, now)
          if (preview.ok) {
            latestPreview = {
              segmentId: preview.value.segmentId,
              segmentName: preview.value.segmentName,
              evaluatedAt: preview.value.evaluatedAt,
              audience: preview.value.audience,
              disclosures: preview.value.disclosures,
            }
          }
        }
      }

      crmAudiencePlanning = {
        status: 'AVAILABLE',
        sourceModule: 'marketing.crm_audience_planning',
        data: {
          planningOnly: true,
          notSendAuthorization: true,
          segmentCatalogCount: catalog.ok ? catalog.value.length : 0,
          eligibleSegmentCount: catalog.ok
            ? catalog.value.filter((row) => row.audiencePlanningEligible).length
            : 0,
          latestPreview,
        },
      }
    } catch (error) {
      if (isPrismaMissingTableError(error)) {
        crmAudiencePlanning = unavailable(
          'marketing.crm_audience_planning',
          'DATA_UNAVAILABLE',
          'CRM audience planning data unavailable',
        )
      } else {
        throw error
      }
    }
  }

  let socialProviderReadiness: MarketingExecutionSummaryResponse['socialProviderReadiness'] = unavailable(
    'marketing.social_provider_readiness',
    'SOCIAL_READINESS_DISABLED',
    'Social provider readiness unavailable',
  )
  const socialBlocked = resolveSocialReadinessSliceAccess(ctx)
  if (socialBlocked) {
    socialProviderReadiness = unavailable(
      'marketing.social_provider_readiness',
      socialBlocked.reasonCode,
      socialBlocked.message,
    )
  } else {
    try {
      const readiness = await buildPostizProviderReadiness(customerAccountId)
      if (!readiness.ok) {
        socialProviderReadiness = unavailable(
          'marketing.social_provider_readiness',
          readiness.code,
          readiness.message,
        )
      } else {
        socialProviderReadiness = {
          status: 'AVAILABLE',
          sourceModule: 'marketing.social_provider_readiness',
          data: mapPostizReadinessForExecutionSummary(readiness.value),
        }
      }
    } catch (error) {
      if (isPrismaMissingTableError(error)) {
        socialProviderReadiness = unavailable(
          'marketing.social_provider_readiness',
          'DATA_UNAVAILABLE',
          'Social provider readiness data unavailable',
        )
      } else {
        socialProviderReadiness = unavailable(
          'marketing.social_provider_readiness',
          'SOURCE_UNAVAILABLE',
          'Social provider readiness could not be assessed',
        )
      }
    }
  }

  const livePublishing = isPostizLivePublishingEnabled()
  const postizApi = isPostizApiEnabled()
  const socialHandoffPolicy: MarketingExecutionSummaryResponse['socialHandoffPolicy'] = {
    status: 'AVAILABLE',
    sourceModule: 'marketing.social_handoff_policy',
    data: {
      dispatchBlocked: true,
      handoffMode: 'PREPARATION_ONLY',
      livePublishingEnabled: livePublishing,
      postizApiEnabled: postizApi,
    },
  }

  return {
    ok: true,
    value: {
      customerAccountId,
      managedSiteId: scope.managedSiteId,
      assembledAt: now.toISOString(),
      accountScope: 'session_membership',
      provenanceNotice: MARKETING_EXECUTION_PROVENANCE_NOTICE,
      planningDisclosure: MARKETING_EXECUTION_PLANNING_DISCLOSURE,
      workflowCounts,
      reviewEvidence,
      crmAudiencePlanning,
      socialProviderReadiness,
      socialHandoffPolicy,
    },
  }
}
