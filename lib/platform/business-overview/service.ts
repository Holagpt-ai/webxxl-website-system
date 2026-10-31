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
  BUSINESS_OVERVIEW_COMMS_INBOX_ACTIONS,
  BUSINESS_OVERVIEW_MAX_ACTIONS,
  BUSINESS_OVERVIEW_MAX_ACTIONS_PER_MODULE,
} from '@/lib/platform/business-overview/constants'
import {
  businessOverviewDataAccess,
  type BusinessOverviewDataAccess,
} from '@/lib/platform/business-overview/data-access'
import { BUSINESS_DESTINATIONS } from '@/lib/platform/business-overview/destinations'
import { compareActionPriority, priorityFromDueDate, priorityFromSeoScore } from '@/lib/platform/business-overview/priority'
import { accountTotal, boundedSample, sumAccountTotals } from '@/lib/platform/business-overview/summary'
import type {
  BusinessOverviewAction,
  BusinessOverviewModule,
  BusinessOverviewModuleSnapshot,
  BusinessOverviewResponse,
} from '@/lib/platform/business-overview/types'

const MODULE_UNAVAILABLE_MESSAGE = 'This module is temporarily unavailable. Try again later.'

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

function moduleUnavailable(
  module: BusinessOverviewModule,
  reasonCode: string,
): BusinessOverviewModuleSnapshot & { actions: BusinessOverviewAction[] } {
  return {
    module,
    readiness: {
      state: 'unavailable',
      reasonCode,
      message: MODULE_UNAVAILABLE_MESSAGE,
    },
    actions: [],
  }
}

async function collectCrm(
  ctx: ModuleAccessContext,
  now: Date,
  data: BusinessOverviewDataAccess,
): Promise<BusinessOverviewModuleSnapshot & { actions: BusinessOverviewAction[] }> {
  const access = resolveCrmModuleAccess(ctx)
  if (access !== 'proceed') {
    return { module: 'crm', readiness: access, actions: [] }
  }
  const accountId = ctx.portal.customerAccount.id
  const checkedAt = now.toISOString()
  try {
    const [openTasksTotal, openDealsTotal, pendingMergesTotal, tasks, deals, pendingMerges] = await Promise.all([
      data.countCrmOpenTasks(accountId),
      data.countCrmOpenDeals(accountId),
      data.countPendingMergeProposals(accountId),
      data.fetchCrmOpenTasks(accountId),
      data.fetchCrmOpenDeals(accountId),
      data.fetchPendingMergeProposals(accountId),
    ])
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
    const summary = {
      openTasks: accountTotal(openTasksTotal),
      openDeals: accountTotal(openDealsTotal),
      pendingMerges: accountTotal(pendingMergesTotal),
      openTasksSample: boundedSample(tasks.length),
      openDealsSample: boundedSample(deals.length),
      pendingMergesSample: boundedSample(pendingMerges.length),
    }
    return {
      module: 'crm',
      readiness: availableReadiness(checkedAt, sumAccountTotals(summary)),
      summary,
      actions,
    }
  } catch (error) {
    if (isPrismaMissingTableError(error)) {
      return { module: 'crm', readiness: unavailableReadiness('crm', 'CRM tables not migrated'), actions: [] }
    }
    throw error
  }
}

async function collectMarketing(
  ctx: ModuleAccessContext,
  now: Date,
  data: BusinessOverviewDataAccess,
): Promise<BusinessOverviewModuleSnapshot & { actions: BusinessOverviewAction[] }> {
  const access = resolveMarketingModuleAccess(ctx)
  if (access !== 'proceed') {
    return { module: 'marketing', readiness: access, actions: [] }
  }
  const accountId = ctx.portal.customerAccount.id
  const checkedAt = now.toISOString()
  try {
    const [draftRequestsTotal, submittedReviewsTotal, draftArtifactsTotal, draftRequests, reviewsResult, artifactsResult] =
      await Promise.all([
        data.countMarketingDraftRequests(accountId),
        data.countMarketingSubmittedReviews(accountId),
        data.countMarketingDraftArtifacts(accountId),
        data.fetchMarketingDraftRequests(accountId),
        data.fetchMarketingReviews({
          customerAccountId: accountId,
          viewerCanDecide: marketingViewerCanDecide(ctx),
        }),
        data.fetchMarketingDraftArtifacts(accountId),
      ])
    if (!reviewsResult.ok) {
      return moduleUnavailable('marketing', reviewsResult.code ?? 'SOURCE_UNAVAILABLE')
    }
    if (!artifactsResult.ok) {
      return moduleUnavailable('marketing', artifactsResult.code ?? 'SOURCE_UNAVAILABLE')
    }
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
    const summary = {
      draftRequests: accountTotal(draftRequestsTotal),
      pendingReviews: accountTotal(submittedReviewsTotal),
      preparedArtifacts: accountTotal(draftArtifactsTotal),
      draftRequestsSample: boundedSample(draftRequests.length),
      pendingReviewsSample: boundedSample(reviewsResult.value.reviews.length),
      preparedArtifactsSample: boundedSample(artifactsResult.value.artifacts.length),
    }
    return {
      module: 'marketing',
      readiness: availableReadiness(checkedAt, sumAccountTotals(summary)),
      summary,
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

async function collectSeo(
  ctx: ModuleAccessContext,
  now: Date,
  data: BusinessOverviewDataAccess,
): Promise<BusinessOverviewModuleSnapshot & { actions: BusinessOverviewAction[] }> {
  const access = resolveSeoModuleAccess(ctx)
  if (access !== 'proceed') {
    return { module: 'local_seo', readiness: access, actions: [] }
  }
  const accountId = ctx.portal.customerAccount.id
  const checkedAt = now.toISOString()
  try {
    const [actionableTotal, opportunities] = await Promise.all([
      data.countSeoActionableOpportunities(accountId),
      data.fetchSeoActionableOpportunities(accountId),
    ])
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
    const summary = {
      actionableOpportunities: accountTotal(actionableTotal),
      actionableOpportunitiesSample: boundedSample(opportunities.length),
    }
    return {
      module: 'local_seo',
      readiness: availableReadiness(checkedAt, sumAccountTotals(summary)),
      summary,
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

async function collectComms(
  ctx: ModuleAccessContext,
  now: Date,
  data: BusinessOverviewDataAccess,
): Promise<BusinessOverviewModuleSnapshot & { actions: BusinessOverviewAction[] }> {
  const access = resolveCommsModuleAccess(ctx)
  if (access !== 'proceed') {
    return { module: 'communications', readiness: access, actions: [] }
  }
  const accountId = ctx.portal.customerAccount.id
  const checkedAt = now.toISOString()
  try {
    const [inboxesTotal, needsAttentionTotal, inboxesResult, conversationsResult] = await Promise.all([
      data.countCommsInboxes(accountId),
      data.countCommsNeedsAttentionConversations(accountId),
      data.fetchCommsInboxes(accountId),
      data.fetchCommsNeedsAttentionConversations(accountId),
    ])
    if (!inboxesResult.ok) {
      return moduleUnavailable('communications', inboxesResult.code ?? 'SOURCE_UNAVAILABLE')
    }
    if (!conversationsResult.ok) {
      return moduleUnavailable('communications', conversationsResult.code ?? 'SOURCE_UNAVAILABLE')
    }
    const actions: BusinessOverviewAction[] = []
    let setupActions = 0
    for (const inbox of inboxesResult.value.inboxes) {
      if (inbox.visibilityState === 'VERIFIED') continue
      if (setupActions >= BUSINESS_OVERVIEW_COMMS_INBOX_ACTIONS) break
      setupActions += 1
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
    const summary = {
      inboxes: accountTotal(inboxesTotal),
      needsAttentionConversations: accountTotal(needsAttentionTotal),
      inboxSetupActionsSample: boundedSample(setupActions),
      needsAttentionConversationsSample: boundedSample(conversationsResult.value.conversations.length),
    }
    return {
      module: 'communications',
      readiness: availableReadiness(checkedAt, sumAccountTotals(summary)),
      summary,
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

async function collectWebsiteProjects(
  portal: PortalUser,
  now: Date,
  data: BusinessOverviewDataAccess,
): Promise<BusinessOverviewModuleSnapshot & { actions: BusinessOverviewAction[] }> {
  const accountId = portal.customerAccount.id
  const checkedAt = now.toISOString()
  const [pendingApprovalsTotal, openDependenciesTotal, approvals, dependencies] = await Promise.all([
    data.countPendingProjectApprovals(accountId),
    data.countOpenProjectDependencies(accountId),
    data.fetchPendingProjectApprovals(accountId),
    data.fetchOpenProjectDependencies(accountId),
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
  const summary = {
    pendingApprovals: accountTotal(pendingApprovalsTotal),
    openDependencies: accountTotal(openDependenciesTotal),
    pendingApprovalsSample: boundedSample(approvals.length),
    openDependenciesSample: boundedSample(dependencies.length),
  }
  return {
    module: 'website_projects',
    readiness: availableReadiness(checkedAt, sumAccountTotals(summary)),
    summary,
    actions,
  }
}

export async function getBusinessOverview(
  portal: PortalUser,
  data: BusinessOverviewDataAccess = businessOverviewDataAccess,
): Promise<BusinessOverviewResponse> {
  const now = new Date()
  const ctx = await loadModuleAccessContext(portal)
  const [crm, marketing, seo, comms, projects] = await Promise.all([
    collectCrm(ctx, now, data),
    collectMarketing(ctx, now, data),
    collectSeo(ctx, now, data),
    collectComms(ctx, now, data),
    collectWebsiteProjects(portal, now, data),
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
