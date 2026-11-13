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
import {
  buildStaffCompositionPortal,
  verifyStaffManagedSiteForAccount,
} from '@/lib/platform/admin-operations/staff-portal-context'
import type {
  AdminOperationsSlice,
  AdminOperationsSummaryResponse,
  AdminPlatformQueueCounts,
} from '@/lib/platform/admin-operations/types'
import { getCommerceExecutionSummary } from '@/lib/platform/commerce-execution/service'
import { getCommunicationsExecutionSummary } from '@/lib/platform/comms-execution/service'
import { getMarketingExecutionSummary } from '@/lib/platform/marketing-execution/service'

export type AdminOperationsSummaryResult =
  | { ok: true; value: AdminOperationsSummaryResponse }
  | { ok: false; code: 'NOT_FOUND' | 'VALIDATION' | 'FORBIDDEN'; message: string }

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
}): Promise<AdminOperationsSummaryResult> {
  const generatedAt = new Date().toISOString()
  const customerAccountId = input.customerAccountId?.trim() || null
  const managedSiteId = input.managedSiteId?.trim() || null
  const scope = customerAccountId ? ('customer_account' as const) : ('platform' as const)

  if (managedSiteId && !customerAccountId) {
    return {
      ok: false,
      code: 'VALIDATION',
      message: 'customerAccountId is required when managedSiteId is provided',
    }
  }

  if (customerAccountId && managedSiteId) {
    const site = await verifyStaffManagedSiteForAccount(customerAccountId, managedSiteId)
    if (!site.ok) {
      return { ok: false, code: 'NOT_FOUND', message: site.message }
    }
  }

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
    const composition = await buildStaffCompositionPortal(input.staffUser, customerAccountId)
    if (!composition) {
      accountExecution = unavailable(
        'lib/platform/admin-operations/staff-portal-context.ts',
        'NOT_FOUND',
        'Customer account not found or staff composition denied',
      )
    } else {
      const portal = composition.portal
      const scopedSiteId = managedSiteId
      const [communications, commerce, marketing] = await Promise.all([
        getCommunicationsExecutionSummary({ portal, managedSiteId: scopedSiteId }),
        getCommerceExecutionSummary({ portal, managedSiteId: scopedSiteId }),
        getMarketingExecutionSummary({ portal, managedSiteId: scopedSiteId }),
      ])

      const aiWorkforce = getAiWorkforceExecutionSummary({
        customerAccountId,
        managedSiteId: scopedSiteId,
      })

      accountExecution = available('lib/platform/admin-operations/service.ts', {
        customerAccountId,
        businessName: portal.customerAccount.businessName,
        accountStatus: portal.customerAccount.status,
        staffCompositionKind: composition.kind,
        communications: communications.ok ? communications.value : null,
        commerce: commerce.ok ? commerce.value : null,
        marketing: marketing.ok ? marketing.value : null,
        aiWorkforce,
      })
    }
  }

  return {
    ok: true,
    value: {
      version: ADMIN_OPERATIONS_BATCH_VERSION,
      generatedAt,
      scope,
      customerAccountId,
      managedSiteId,
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
    },
  }
}
