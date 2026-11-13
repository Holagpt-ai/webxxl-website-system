import {
  isCustomerAiExecutionEnabled,
  isCustomerAiOutboundEnabled,
} from '@/config/customer-ai-workforce'
import { isCommerceCheckoutEnabled } from '@/config/commerce-backend'
import { isCommunicationsOutboundEnabled } from '@/config/comms-backend'
import { isWorkflowExternalEffectsEnabled, isWorkflowWorkerEnabled } from '@/config/workflow-backend'
import type { User } from '@prisma/client'
import { getAiWorkforceExecutionSummary } from '@/lib/platform/ai-workforce-execution/summary'
import {
  ADMIN_OPERATIONS_BATCH_VERSION,
  ADMIN_OPERATIONS_DISCLOSURE,
} from '@/lib/platform/admin-operations/constants'
import { loadPlatformOperationalQueues } from '@/lib/platform/admin-operations/platform-queues'
import { buildStaffCompositionPortal } from '@/lib/platform/admin-operations/staff-portal-context'
import type {
  AdminOperationsSlice,
  AdminOperationsSummaryResponse,
  AdminPlatformQueueCounts,
} from '@/lib/platform/admin-operations/types'
import { getCommerceExecutionSummary } from '@/lib/platform/commerce-execution/service'
import { getCommunicationsExecutionSummary } from '@/lib/platform/comms-execution/service'
import { getMarketingExecutionSummary } from '@/lib/platform/marketing-execution/service'

function available<T>(sourceModule: string, data: T): AdminOperationsSlice<T> {
  return { status: 'AVAILABLE', sourceModule, data }
}

function unavailable<T>(sourceModule: string, reasonCode: string, message: string): AdminOperationsSlice<T> {
  return { status: 'UNAVAILABLE', sourceModule, reasonCode, message }
}

export async function getAdminOperationsSummary(input: {
  staffUser: User
  customerAccountId?: string | null
  managedSiteId?: string | null
}): Promise<AdminOperationsSummaryResponse> {
  const generatedAt = new Date().toISOString()
  const customerAccountId = input.customerAccountId?.trim() || null
  const scope = customerAccountId ? ('customer_account' as const) : ('platform' as const)

  const queues = await loadPlatformOperationalQueues(customerAccountId ?? undefined)
  const platformQueues: AdminOperationsSlice<AdminPlatformQueueCounts> = queues.ok
    ? available('lib/platform/admin-operations/platform-queues.ts', queues.value)
    : unavailable<AdminPlatformQueueCounts>(
        'lib/platform/admin-operations/platform-queues.ts',
        queues.reasonCode,
        queues.message,
      )

  const runtimeGates = available('config/*.ts', {
    workflowWorkerEnabled: isWorkflowWorkerEnabled(),
    workflowExternalEffectsEnabled: isWorkflowExternalEffectsEnabled(),
    customerAiExecutionEnabled: isCustomerAiExecutionEnabled(),
    customerAiOutboundEnabled: isCustomerAiOutboundEnabled(),
    commerceCheckoutEnabled: isCommerceCheckoutEnabled(),
    communicationsOutboundEnabled: isCommunicationsOutboundEnabled(),
    liveActivationBlocked: true as const,
  })

  let accountExecution: AdminOperationsSummaryResponse['accountExecution'] = unavailable(
    'lib/platform/admin-operations/service.ts',
    'ACCOUNT_SCOPE_REQUIRED',
    'Provide customerAccountId for per-account execution attachment.',
  )

  if (customerAccountId) {
    const portal = await buildStaffCompositionPortal(input.staffUser, customerAccountId)
    if (!portal) {
      accountExecution = unavailable(
        'lib/platform/admin-operations/staff-portal-context.ts',
        'NOT_FOUND',
        'Customer account not found.',
      )
    } else {
      const [communications, commerce, marketing] = await Promise.all([
        getCommunicationsExecutionSummary({ portal, managedSiteId: input.managedSiteId }),
        getCommerceExecutionSummary({ portal, managedSiteId: input.managedSiteId }),
        getMarketingExecutionSummary({ portal, managedSiteId: input.managedSiteId }),
      ])

      const aiWorkforce = getAiWorkforceExecutionSummary({
        customerAccountId,
        managedSiteId: input.managedSiteId,
      })

      accountExecution = available('lib/platform/admin-operations/service.ts', {
        customerAccountId,
        businessName: portal.customerAccount.businessName,
        accountStatus: portal.customerAccount.status,
        communications: communications.ok ? communications.value : null,
        commerce: commerce.ok ? commerce.value : null,
        marketing: marketing.ok ? marketing.value : null,
        aiWorkforce,
      })
    }
  }

  return {
    version: ADMIN_OPERATIONS_BATCH_VERSION,
    generatedAt,
    scope,
    customerAccountId,
    disclosure: ADMIN_OPERATIONS_DISCLOSURE,
    platformQueues,
    runtimeGates,
    accountExecution,
    publicConversion: available('docs/platform/docs/BATCH7B-ADMIN-UI-INTEGRATION-CONTRACT.md', {
      state: 'DEFERRED_V0',
      uiOwner: 'v0.app',
    }),
    unifiedExperience: available('docs/platform/docs/BATCH7B-ADMIN-UI-INTEGRATION-CONTRACT.md', {
      localeSupport: ['en', 'es'],
      mobilePresentation: 'DEFERRED_V0',
      uiOwner: 'v0.app',
    }),
  }
}
