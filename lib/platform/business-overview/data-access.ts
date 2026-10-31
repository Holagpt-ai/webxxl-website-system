import type { CrmTaskStatus } from '@prisma/client'
import { isMktApprovalWorkflowEnabled } from '@/config/mkt-backend'
import { prisma } from '@/lib/db'
import { listAccountConversations } from '@/lib/platform/comms/conversation-service'
import { listAccountInboxes } from '@/lib/platform/comms/inbox-service'
import {
  BUSINESS_OVERVIEW_COMMS_CONVERSATIONS,
  BUSINESS_OVERVIEW_CRM_DEALS,
  BUSINESS_OVERVIEW_CRM_MERGES,
  BUSINESS_OVERVIEW_CRM_TASKS,
  BUSINESS_OVERVIEW_MKT_ARTIFACTS,
  BUSINESS_OVERVIEW_MKT_REQUESTS,
  BUSINESS_OVERVIEW_MKT_REVIEWS,
  BUSINESS_OVERVIEW_PROJECT_APPROVALS,
  BUSINESS_OVERVIEW_PROJECT_DEPENDENCIES,
  BUSINESS_OVERVIEW_SEO_OPPORTUNITIES,
} from '@/lib/platform/business-overview/constants'
import { listMarketingArtifacts } from '@/lib/platform/marketing/artifact-list-service'
import { listMarketingReviews } from '@/lib/platform/marketing/review-list-service'

const SEO_ACTIONABLE_STATES = ['RECOMMENDED_ACTION', 'DRAFT_PREPARED', 'AWAITING_APPROVAL'] as const

const CRM_OPEN_TASK_STATUSES: CrmTaskStatus[] = ['OPEN', 'IN_PROGRESS']

const crmOpenTaskWhere = {
  status: { in: CRM_OPEN_TASK_STATUSES },
}

export async function countCrmOpenTasks(customerAccountId: string) {
  return prisma.crmTask.count({ where: { customerAccountId, ...crmOpenTaskWhere } })
}

export async function fetchCrmOpenTasks(customerAccountId: string) {
  return prisma.crmTask.findMany({
    where: { customerAccountId, ...crmOpenTaskWhere },
    orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }],
    take: BUSINESS_OVERVIEW_CRM_TASKS,
    select: { id: true, title: true, dueAt: true, updatedAt: true, status: true },
  })
}

export async function countCrmOpenDeals(customerAccountId: string) {
  return prisma.crmDeal.count({ where: { customerAccountId, status: 'OPEN' } })
}

export async function fetchCrmOpenDeals(customerAccountId: string) {
  return prisma.crmDeal.findMany({
    where: { customerAccountId, status: 'OPEN' },
    orderBy: { updatedAt: 'desc' },
    take: BUSINESS_OVERVIEW_CRM_DEALS,
    select: { id: true, title: true, updatedAt: true },
  })
}

export async function countPendingMergeProposals(customerAccountId: string) {
  return prisma.crmMergeProposal.count({ where: { customerAccountId, status: 'PENDING' } })
}

export async function fetchPendingMergeProposals(customerAccountId: string) {
  return prisma.crmMergeProposal.findMany({
    where: { customerAccountId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    take: BUSINESS_OVERVIEW_CRM_MERGES,
    select: { id: true, createdAt: true },
  })
}

export async function countMarketingDraftRequests(customerAccountId: string) {
  return prisma.marketingRequest.count({ where: { customerAccountId, status: 'DRAFT' } })
}

export async function fetchMarketingDraftRequests(customerAccountId: string) {
  return prisma.marketingRequest.findMany({
    where: { customerAccountId, status: 'DRAFT' },
    orderBy: { updatedAt: 'desc' },
    take: BUSINESS_OVERVIEW_MKT_REQUESTS,
    select: { id: true, goal: true, brief: true, updatedAt: true },
  })
}

export async function countMarketingSubmittedReviews(customerAccountId: string) {
  const now = new Date()
  return prisma.marketingArtifactReview.count({
    where: {
      customerAccountId,
      status: 'SUBMITTED',
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
    },
  })
}

export async function countMarketingDraftArtifacts(customerAccountId: string) {
  return prisma.marketingArtifact.count({
    where: { customerAccountId, reviewStatus: 'DRAFT' },
  })
}

export function fetchMarketingReviews(input: {
  customerAccountId: string
  viewerCanDecide: boolean
}) {
  return listMarketingReviews({
    customerAccountId: input.customerAccountId,
    status: 'SUBMITTED',
    take: BUSINESS_OVERVIEW_MKT_REVIEWS,
    viewerCanDecide: input.viewerCanDecide,
    approvalWorkflowEnabled: isMktApprovalWorkflowEnabled(),
  })
}

export function fetchMarketingDraftArtifacts(customerAccountId: string) {
  return listMarketingArtifacts({
    customerAccountId,
    reviewStatus: 'DRAFT',
    take: BUSINESS_OVERVIEW_MKT_ARTIFACTS,
  })
}

export async function countSeoActionableOpportunities(customerAccountId: string) {
  return prisma.seoOpportunity.count({
    where: { customerAccountId, state: { in: [...SEO_ACTIONABLE_STATES] } },
  })
}

export async function fetchSeoActionableOpportunities(customerAccountId: string) {
  return prisma.seoOpportunity.findMany({
    where: { customerAccountId, state: { in: [...SEO_ACTIONABLE_STATES] } },
    orderBy: [{ priorityScore: 'desc' }, { id: 'asc' }],
    take: BUSINESS_OVERVIEW_SEO_OPPORTUNITIES,
    select: {
      id: true,
      managedSiteId: true,
      state: true,
      priorityScore: true,
      recommendation: true,
      updatedAt: true,
    },
  })
}

export async function countCommsInboxes(customerAccountId: string) {
  return prisma.chatwootInboxMapping.count({ where: { customerAccountId } })
}

export async function countCommsNeedsAttentionConversations(customerAccountId: string) {
  return prisma.chatwootConversationMapping.count({
    where: { customerAccountId, syncError: { not: null } },
  })
}

export function fetchCommsInboxes(customerAccountId: string) {
  return listAccountInboxes({ customerAccountId })
}

export function fetchCommsNeedsAttentionConversations(customerAccountId: string) {
  return listAccountConversations({
    customerAccountId,
    filter: 'needs_attention',
    take: BUSINESS_OVERVIEW_COMMS_CONVERSATIONS,
  })
}

export async function countPendingProjectApprovals(customerAccountId: string) {
  return prisma.projectApproval.count({
    where: { project: { customerAccountId }, status: 'PENDING' },
  })
}

export async function fetchPendingProjectApprovals(customerAccountId: string) {
  return prisma.projectApproval.findMany({
    where: { project: { customerAccountId }, status: 'PENDING' },
    orderBy: { requestedAt: 'desc' },
    take: BUSINESS_OVERVIEW_PROJECT_APPROVALS,
    select: { id: true, title: true, requestedAt: true, projectId: true },
  })
}

export async function countOpenProjectDependencies(customerAccountId: string) {
  return prisma.projectDependency.count({
    where: {
      project: { customerAccountId },
      status: { in: ['REQUESTED', 'IN_PROGRESS'] },
    },
  })
}

export async function fetchOpenProjectDependencies(customerAccountId: string) {
  return prisma.projectDependency.findMany({
    where: {
      project: { customerAccountId },
      status: { in: ['REQUESTED', 'IN_PROGRESS'] },
    },
    orderBy: [{ dueDate: 'asc' }, { requestedFromCustomerAt: 'desc' }],
    take: BUSINESS_OVERVIEW_PROJECT_DEPENDENCIES,
    select: { id: true, title: true, dueDate: true, requestedFromCustomerAt: true, projectId: true },
  })
}

export const businessOverviewDataAccess = {
  countCrmOpenTasks,
  fetchCrmOpenTasks,
  countCrmOpenDeals,
  fetchCrmOpenDeals,
  countPendingMergeProposals,
  fetchPendingMergeProposals,
  countMarketingDraftRequests,
  fetchMarketingDraftRequests,
  countMarketingSubmittedReviews,
  countMarketingDraftArtifacts,
  fetchMarketingReviews,
  fetchMarketingDraftArtifacts,
  countSeoActionableOpportunities,
  fetchSeoActionableOpportunities,
  countCommsInboxes,
  countCommsNeedsAttentionConversations,
  fetchCommsInboxes,
  fetchCommsNeedsAttentionConversations,
  countPendingProjectApprovals,
  fetchPendingProjectApprovals,
  countOpenProjectDependencies,
  fetchOpenProjectDependencies,
}

export type BusinessOverviewDataAccess = typeof businessOverviewDataAccess
