import { isMktApprovalWorkflowEnabled } from '@/config/mkt-backend'
import { prisma } from '@/lib/db'
import type { PortalUser } from '@/lib/portal/authz'
import {
  availableReadiness,
  isPrismaMissingTableError,
  loadModuleAccessContext,
  marketingViewerCanDecide,
  resolveCommsModuleAccess,
  resolveCrmModuleAccess,
  resolveMarketingModuleAccess,
  resolveSeoModuleAccess,
  unavailableReadiness,
  type ModuleAccessContext,
} from '@/lib/platform/business-overview/access'
import {
  BUSINESS_OVERVIEW_COMMS_CONVERSATIONS,
  BUSINESS_OVERVIEW_CRM_DEALS,
  BUSINESS_OVERVIEW_CRM_MERGES,
  BUSINESS_OVERVIEW_CRM_TASKS,
  BUSINESS_OVERVIEW_MAX_ACTIONS,
  BUSINESS_OVERVIEW_MAX_ACTIONS_PER_MODULE,
  BUSINESS_OVERVIEW_MKT_ARTIFACTS,
  BUSINESS_OVERVIEW_MKT_REQUESTS,
  BUSINESS_OVERVIEW_MKT_REVIEWS,
  BUSINESS_OVERVIEW_PROJECT_APPROVALS,
  BUSINESS_OVERVIEW_PROJECT_DEPENDENCIES,
  BUSINESS_OVERVIEW_SEO_OPPORTUNITIES,
} from '@/lib/platform/business-overview/constants'
import { BUSINESS_DESTINATIONS } from '@/lib/platform/business-overview/destinations'
import { compareActionPriority, priorityFromDueDate, priorityFromSeoScore } from '@/lib/platform/business-overview/priority'
import type {
  BusinessOverviewAction,
  BusinessOverviewModuleSnapshot,
  BusinessOverviewResponse,
} from '@/lib/platform/business-overview/types'
import { listMergeProposals } from '@/lib/platform/crm/dedup-service'
import { listAccountConversations } from '@/lib/platform/comms/conversation-service'
import { listAccountInboxes } from '@/lib/platform/comms/inbox-service'
import { listMarketingArtifacts } from '@/lib/platform/marketing/artifact-list-service'
import { listMarketingReviews } from '@/lib/platform/marketing/review-list-service'

const SEO_ACTIONABLE_STATES = ['RECOMMENDED_ACTION', 'DRAFT_PREPARED', 'AWAITING_APPROVAL'] as const

function sortAndCapActions(actions: BusinessOverviewAction[]): BusinessOverviewAction[] {
  const byModule = new Map<string, number>()
  const sorted = [...actions].sort((a, b) => {
    const p = compareActionPriority(a.priority, b.priority)
    if (p !== 0) return p
    return b.timestamp.localeCompare(a.timestamp)
  })
  const kept: BusinessOverviewAction[] = []
  for (const action of sorted) {
    if (kept.length >= BUSINESS_OVERVIEW_MAX_ACTIONS) break
    const count = byModule.get(action.module) ?? 0
    if (count >= BUSINESS_OVERVIEW_MAX_ACTIONS_PER_MODULE) continue
    byModule.set(action.module, count + 1)
    kept.push(action)
  }
  return kept
}

async function collectCrm(ctx: ModuleAccessContext, now: Date): Promise<BusinessOverviewModuleSnapshot & { actions: BusinessOverviewAction[] }> {
  const access = resolveCrmModuleAccess(ctx)
  if (access !== 'proceed') {
    return { module: 'crm', readiness: access, actions: [] }
  }
  const accountId = ctx.portal.customerAccount.id
  const checkedAt = now.toISOString()
  try {
    const [tasks, deals, proposals] = await Promise.all([
      prisma.crmTask.findMany({
        where: { customerAccountId: accountId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
        orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }],
        take: BUSINESS_OVERVIEW_CRM_TASKS,
        select: { id: true, title: true, dueAt: true, updatedAt: true, status: true },
      }),
      prisma.crmDeal.findMany({
        where: { customerAccountId: accountId, status: 'OPEN' },
        orderBy: { updatedAt: 'desc' },
        take: BUSINESS_OVERVIEW_CRM_DEALS,
        select: { id: true, title: true, updatedAt: true },
      }),
      listMergeProposals(accountId, 'PENDING'),
    ])
    const pendingMerges = proposals.slice(0, BUSINESS_OVERVIEW_CRM_MERGES)
    const actions: BusinessOverviewAction[] = []
    for (const task of tasks) {
      const overdue = task.dueAt != null && task.dueAt.getTime() < now.getTime()
      actions.push({
        module: 'crm',
        actionType: overdue ? 'crm.task.overdue' : 'crm.task.open',
        recordRef: { kind: 'crm_task', id: task.id },
        priority: priorityFromDueDate(task.dueAt, now),
        title: task.title,
        destination: { path: BUSINESS_DESTINATIONS.crmTasks },
        timestamp: (task.dueAt ?? task.updatedAt).toISOString(),
        dueAt: task.dueAt?.toISOString() ?? null,
        customerAccountId: accountId,
      })
    }
    for (const deal of deals) {
      actions.push({
        module: 'crm',
        actionType: 'crm.deal.open',
        recordRef: { kind: 'crm_deal', id: deal.id },
        priority: 'normal',
        title: deal.title,
        destination: { path: BUSINESS_DESTINATIONS.crmPipeline },
        timestamp: deal.updatedAt.toISOString(),
        dueAt: null,
        customerAccountId: accountId,
      })
    }
    for (const merge of pendingMerges) {
      actions.push({
        module: 'crm',
        actionType: 'crm.merge.pending',
        recordRef: { kind: 'crm_merge_proposal', id: merge.id },
        priority: 'medium',
        title: 'Pending contact merge review',
        destination: { path: BUSINESS_DESTINATIONS.crmMerges },
        timestamp: merge.createdAt.toISOString(),
        dueAt: null,
        customerAccountId: accountId,
      })
    }
    const evidenceCount = tasks.length + deals.length + pendingMerges.length
    return {
      module: 'crm',
      readiness: availableReadiness(checkedAt, evidenceCount),
      summary: {
        openTasks: tasks.length,
        openDeals: deals.length,
        pendingMerges: pendingMerges.length,
      },
      actions,
    }
  } catch (error) {
    if (isPrismaMissingTableError(error)) {
      return { module: 'crm', readiness: unavailableReadiness('crm', 'CRM tables not migrated'), actions: [] }
    }
    throw error
  }
}

async function collectMarketing(ctx: ModuleAccessContext, now: Date): Promise<BusinessOverviewModuleSnapshot & { actions: BusinessOverviewAction[] }> {
  const access = resolveMarketingModuleAccess(ctx)
  if (access !== 'proceed') {
    return { module: 'marketing', readiness: access, actions: [] }
  }
  const accountId = ctx.portal.customerAccount.id
  const checkedAt = now.toISOString()
  try {
    const [draftRequests, reviewsResult, artifactsResult] = await Promise.all([
      prisma.marketingRequest.findMany({
        where: { customerAccountId: accountId, status: 'DRAFT' },
        orderBy: { updatedAt: 'desc' },
        take: BUSINESS_OVERVIEW_MKT_REQUESTS,
        select: { id: true, goal: true, brief: true, updatedAt: true },
      }),
      listMarketingReviews({
        customerAccountId: accountId,
        status: 'SUBMITTED',
        take: BUSINESS_OVERVIEW_MKT_REVIEWS,
        viewerCanDecide: marketingViewerCanDecide(ctx),
        approvalWorkflowEnabled: isMktApprovalWorkflowEnabled(),
      }),
      listMarketingArtifacts({
        customerAccountId: accountId,
        reviewStatus: 'DRAFT',
        take: BUSINESS_OVERVIEW_MKT_ARTIFACTS,
      }),
    ])
    const actions: BusinessOverviewAction[] = []
    for (const req of draftRequests) {
      actions.push({
        module: 'marketing',
        actionType: 'marketing.request.draft',
        recordRef: { kind: 'marketing_request', id: req.id },
        priority: 'normal',
        title: req.goal?.trim() || req.brief.slice(0, 80),
        destination: { path: BUSINESS_DESTINATIONS.marketingRequest(req.id) },
        timestamp: req.updatedAt.toISOString(),
        dueAt: null,
        customerAccountId: accountId,
      })
    }
    if (reviewsResult.ok) {
      for (const review of reviewsResult.value.reviews) {
        if (review.effectiveStatus !== 'SUBMITTED') continue
        actions.push({
          module: 'marketing',
          actionType: 'marketing.review.pending',
          recordRef: { kind: 'marketing_review', id: review.id },
          priority: review.expiresAt ? priorityFromDueDate(review.expiresAt, now) : 'medium',
          title: `Deliverable review (${review.revisionHash.slice(0, 8)})`,
          destination: { path: BUSINESS_DESTINATIONS.marketingApprovals },
          timestamp: review.createdAt.toISOString(),
          dueAt: review.expiresAt?.toISOString() ?? null,
          customerAccountId: accountId,
        })
      }
    }
    if (artifactsResult.ok) {
      for (const artifact of artifactsResult.value.artifacts) {
        actions.push({
          module: 'marketing',
          actionType: 'marketing.artifact.prepared',
          recordRef: { kind: 'marketing_artifact', id: artifact.id },
          priority: 'low',
          title: `${artifact.artifactType} draft`,
          destination: { path: BUSINESS_DESTINATIONS.marketingDeliverable(artifact.id) },
          timestamp: artifact.createdAt.toISOString(),
          dueAt: null,
          customerAccountId: accountId,
        })
      }
    }
    const reviewCount = reviewsResult.ok ? reviewsResult.value.reviews.length : 0
    const artifactCount = artifactsResult.ok ? artifactsResult.value.artifacts.length : 0
    const evidenceCount = draftRequests.length + reviewCount + artifactCount
    return {
      module: 'marketing',
      readiness: availableReadiness(checkedAt, evidenceCount),
      summary: {
        draftRequests: draftRequests.length,
        pendingReviews: reviewCount,
        preparedArtifacts: artifactCount,
      },
      actions,
    }
  } catch (error) {
    if (isPrismaMissingTableError(error)) {
      return {
        module: 'marketing',
        readiness: unavailableReadiness('marketing', 'Marketing tables not migrated'),
        actions: [],
      }
    }
    throw error
  }
}

async function collectSeo(ctx: ModuleAccessContext, now: Date): Promise<BusinessOverviewModuleSnapshot & { actions: BusinessOverviewAction[] }> {
  const access = resolveSeoModuleAccess(ctx)
  if (access !== 'proceed') {
    return { module: 'local_seo', readiness: access, actions: [] }
  }
  const accountId = ctx.portal.customerAccount.id
  const checkedAt = now.toISOString()
  try {
    const opportunities = await prisma.seoOpportunity.findMany({
      where: {
        customerAccountId: accountId,
        state: { in: [...SEO_ACTIONABLE_STATES] },
      },
      orderBy: [{ priorityScore: 'desc' }, { id: 'asc' }],
      take: BUSINESS_OVERVIEW_SEO_OPPORTUNITIES,
      select: {
        id: true,
        managedSiteId: true,
        state: true,
        priorityScore: true,
        recommendation: true,
        observedAt: true,
        updatedAt: true,
      },
    })
    const actions: BusinessOverviewAction[] = opportunities.map((op) => ({
      module: 'local_seo',
      actionType: 'local_seo.opportunity.actionable',
      recordRef: { kind: 'seo_opportunity', id: op.id },
      priority: priorityFromSeoScore(op.priorityScore),
      title: op.recommendation.slice(0, 120),
      destination: { path: BUSINESS_DESTINATIONS.seoOpportunitySite(op.managedSiteId) },
      timestamp: op.updatedAt.toISOString(),
      dueAt: null,
      customerAccountId: accountId,
    }))
    return {
      module: 'local_seo',
      readiness: availableReadiness(checkedAt, opportunities.length),
      summary: { actionableOpportunities: opportunities.length },
      actions,
    }
  } catch (error) {
    if (isPrismaMissingTableError(error)) {
      return {
        module: 'local_seo',
        readiness: unavailableReadiness('local_seo', 'SEO tables not migrated'),
        actions: [],
      }
    }
    throw error
  }
}

async function collectComms(ctx: ModuleAccessContext, now: Date): Promise<BusinessOverviewModuleSnapshot & { actions: BusinessOverviewAction[] }> {
  const access = resolveCommsModuleAccess(ctx)
  if (access !== 'proceed') {
    return { module: 'communications', readiness: access, actions: [] }
  }
  const accountId = ctx.portal.customerAccount.id
  const checkedAt = now.toISOString()
  try {
    const [inboxesResult, conversationsResult] = await Promise.all([
      listAccountInboxes({ customerAccountId: accountId }),
      listAccountConversations({
        customerAccountId: accountId,
        filter: 'needs_attention',
        take: BUSINESS_OVERVIEW_COMMS_CONVERSATIONS,
      }),
    ])
    const actions: BusinessOverviewAction[] = []
    if (inboxesResult.ok) {
      for (const inbox of inboxesResult.value.inboxes) {
        if (inbox.visibilityState === 'VERIFIED') continue
        actions.push({
          module: 'communications',
          actionType: 'communications.inbox.setup',
          recordRef: { kind: 'comms_inbox', id: inbox.id },
          priority: 'medium',
          title: `Inbox setup (${inbox.channelType ?? 'channel'})`,
          destination: { path: BUSINESS_DESTINATIONS.commsInbox },
          timestamp: inbox.lastSyncAt ?? checkedAt,
          dueAt: null,
          customerAccountId: accountId,
        })
      }
    }
    if (conversationsResult.ok) {
      for (const conv of conversationsResult.value.conversations) {
        actions.push({
          module: 'communications',
          actionType: 'communications.conversation.needs_attention',
          recordRef: { kind: 'comms_conversation', id: conv.id },
          priority: conv.syncStale ? 'high' : 'medium',
          title: `Conversation ${conv.externalConversationId}`,
          destination: { path: BUSINESS_DESTINATIONS.commsConversation(conv.id) },
          timestamp: (conv.lastActivityAt ?? conv.lastSyncAt ?? now).toISOString(),
          dueAt: null,
          customerAccountId: accountId,
        })
      }
    }
    const inboxCount = inboxesResult.ok ? inboxesResult.value.inboxes.length : 0
    const convCount = conversationsResult.ok ? conversationsResult.value.conversations.length : 0
    const evidenceCount = actions.length
    return {
      module: 'communications',
      readiness: availableReadiness(checkedAt, evidenceCount),
      summary: { inboxes: inboxCount, needsAttentionConversations: convCount },
      actions,
    }
  } catch (error) {
    if (isPrismaMissingTableError(error)) {
      return {
        module: 'communications',
        readiness: unavailableReadiness('communications', 'Communications tables not migrated'),
        actions: [],
      }
    }
    throw error
  }
}

async function collectWebsiteProjects(ctx: PortalUser, now: Date): Promise<BusinessOverviewModuleSnapshot & { actions: BusinessOverviewAction[] }> {
  const accountId = ctx.customerAccount.id
  const checkedAt = now.toISOString()
  const [approvals, dependencies] = await Promise.all([
    prisma.projectApproval.findMany({
      where: { project: { customerAccountId: accountId }, status: 'PENDING' },
      orderBy: { requestedAt: 'desc' },
      take: BUSINESS_OVERVIEW_PROJECT_APPROVALS,
      select: { id: true, title: true, requestedAt: true, projectId: true },
    }),
    prisma.projectDependency.findMany({
      where: {
        project: { customerAccountId: accountId },
        status: { in: ['REQUESTED', 'IN_PROGRESS'] },
      },
      orderBy: [{ dueDate: 'asc' }, { requestedFromCustomerAt: 'desc' }],
      take: BUSINESS_OVERVIEW_PROJECT_DEPENDENCIES,
      select: { id: true, title: true, dueDate: true, requestedFromCustomerAt: true, projectId: true },
    }),
  ])
  const actions: BusinessOverviewAction[] = []
  for (const approval of approvals) {
    actions.push({
      module: 'website_projects',
      actionType: 'website_projects.approval.pending',
      recordRef: { kind: 'project_approval', id: approval.id },
      priority: 'medium',
      title: approval.title,
      destination: { path: BUSINESS_DESTINATIONS.projectApprovals },
      timestamp: approval.requestedAt.toISOString(),
      dueAt: null,
      customerAccountId: accountId,
    })
  }
  for (const dep of dependencies) {
    actions.push({
      module: 'website_projects',
      actionType: 'website_projects.dependency.open',
      recordRef: { kind: 'project_dependency', id: dep.id },
      priority: priorityFromDueDate(dep.dueDate, now),
      title: dep.title,
      destination: { path: BUSINESS_DESTINATIONS.projectDetail },
      timestamp: (dep.dueDate ?? dep.requestedFromCustomerAt).toISOString(),
      dueAt: dep.dueDate?.toISOString() ?? null,
      customerAccountId: accountId,
    })
  }
  const evidenceCount = approvals.length + dependencies.length
  return {
    module: 'website_projects',
    readiness: availableReadiness(checkedAt, evidenceCount),
    summary: { pendingApprovals: approvals.length, openDependencies: dependencies.length },
    actions,
  }
}

export async function getBusinessOverview(portal: PortalUser): Promise<BusinessOverviewResponse> {
  const now = new Date()
  const ctx = await loadModuleAccessContext(portal)
  const [crm, marketing, seo, comms, projects] = await Promise.all([
    collectCrm(ctx, now),
    collectMarketing(ctx, now),
    collectSeo(ctx, now),
    collectComms(ctx, now),
    collectWebsiteProjects(portal, now),
  ])
  const modules: BusinessOverviewModuleSnapshot[] = [crm, marketing, seo, comms, projects].map(({ actions: _, ...snap }) => snap)
  const actions = sortAndCapActions([
    ...crm.actions,
    ...marketing.actions,
    ...seo.actions,
    ...comms.actions,
    ...projects.actions,
  ])
  return {
    customerAccountId: portal.customerAccount.id,
    generatedAt: now.toISOString(),
    accountScope: 'session_membership',
    modules,
    actions,
    limits: {
      maxActionsReturned: BUSINESS_OVERVIEW_MAX_ACTIONS,
      maxActionsPerModule: BUSINESS_OVERVIEW_MAX_ACTIONS_PER_MODULE,
    },
  }
}
