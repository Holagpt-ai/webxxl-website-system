import type { ADMIN_OPERATIONS_BATCH_VERSION, ADMIN_OPERATIONS_DISCLOSURE } from '@/lib/platform/admin-operations/constants'
import type { AiWorkforceExecutionSummary } from '@/lib/platform/ai-workforce-execution/summary'
import type { CommerceExecutionSummaryResponse } from '@/lib/platform/commerce-execution/types'
import type { CommsExecutionSummaryResponse } from '@/lib/platform/comms-execution/types'
import type { MarketingExecutionSummaryResponse } from '@/lib/platform/marketing-execution/types'

export type AdminOperationsSlice<T> = {
  status: 'AVAILABLE' | 'UNAVAILABLE'
  sourceModule: string
  reasonCode?: string
  message?: string
  data?: T
}

export type AdminPlatformQueueCounts = {
  activeCustomerAccounts: number
  activeProjects: number
  pendingProjectApprovals: number
  openChangeRequests: number
  openSupportRequests: number
  openServiceOrders: number
  websiteLeadsAwaitingReview: number
  blockedProjectTasks: number
  overdueProjectTasks: number
}

export type AdminRuntimeGateSnapshot = {
  workflowWorkerEnabled: boolean
  workflowExternalEffectsEnabled: boolean
  customerAiExecutionEnabled: boolean
  customerAiOutboundEnabled: boolean
  commerceCheckoutEnabled: boolean
  communicationsOutboundEnabled: boolean
  liveActivationBlocked: true
}

export type AdminAccountExecutionAttachment = {
  customerAccountId: string
  businessName: string
  accountStatus: string
  staffCompositionKind: 'staff_readonly_composition'
  communications: CommsExecutionSummaryResponse | null
  commerce: CommerceExecutionSummaryResponse | null
  marketing: MarketingExecutionSummaryResponse | null
  aiWorkforce: AiWorkforceExecutionSummary | null
}

export type AdminOperationsSummaryResponse = {
  version: typeof ADMIN_OPERATIONS_BATCH_VERSION
  generatedAt: string
  scope: 'platform' | 'customer_account'
  customerAccountId: string | null
  managedSiteId: string | null
  disclosure: typeof ADMIN_OPERATIONS_DISCLOSURE
  platformQueues: AdminOperationsSlice<AdminPlatformQueueCounts>
  runtimeGates: AdminOperationsSlice<AdminRuntimeGateSnapshot>
  accountExecution: AdminOperationsSlice<AdminAccountExecutionAttachment>
  publicConversion: AdminOperationsSlice<{ state: 'DEFERRED_V0'; uiOwner: 'v0.app' }>
  unifiedExperience: AdminOperationsSlice<{
    localeSupport: ['en', 'es']
    mobilePresentation: 'DEFERRED_V0'
    uiOwner: 'v0.app'
  }>
}
