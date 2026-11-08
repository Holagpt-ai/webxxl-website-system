import { prisma } from '@/lib/db'
import {
  isCommunicationsOutboundEnabled,
  isEmailSendEnabled,
  isSmsSendEnabled,
} from '@/config/comms-backend'
import {
  isWalletCommsIntegrationEnabled,
  isWalletReservationEnabled,
} from '@/config/wallet-backend'
import type { PortalUser } from '@/lib/portal/authz'
import { isPrismaMissingTableError } from '@/lib/platform/business-overview/access'
import { buildChatwootIntegrationReadiness } from '@/lib/platform/comms/chatwoot-readiness-service'
import { listAccountInboxes } from '@/lib/platform/comms/inbox-service'
import { buildMessagingProviderReadiness } from '@/lib/platform/comms/messaging-provider-readiness'
import { getWalletBalance } from '@/lib/platform/wallet/durable-service'
import {
  COMMS_EXECUTION_BATCH_VERSION,
  COMMS_EXECUTION_PLANNING_DISCLOSURE,
  COMMS_EXECUTION_PROVENANCE_NOTICE,
  PREPARATION_ONLY_DISPATCH_BLOCKED_CODE,
  PREPARATION_ONLY_DISPATCH_BLOCKED_MESSAGE,
} from '@/lib/platform/comms-execution/constants'
import {
  loadCommsExecutionContext,
  resolveCommsExecutionCoreAccess,
  resolveCommsIntegrationSliceAccess,
} from '@/lib/platform/comms-execution/access'
import type {
  CommsExecutionSlice,
  CommsExecutionSummaryResponse,
} from '@/lib/platform/comms-execution/types'

export type CommsExecutionResult =
  | { ok: true; value: CommsExecutionSummaryResponse }
  | { ok: false; code: 'NOT_FOUND'; message: string }

function unavailable<T>(
  sourceModule: CommsExecutionSlice<T>['sourceModule'],
  reasonCode: string,
  message: string,
): CommsExecutionSlice<T> {
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

export async function getCommunicationsExecutionSummary(input: {
  portal: PortalUser
  managedSiteId?: string | null
}): Promise<CommsExecutionResult> {
  const now = new Date()
  const customerAccountId = input.portal.customerAccount.id
  const scope = await resolveManagedSiteScope(customerAccountId, input.managedSiteId)
  if (!scope.ok) {
    return { ok: false, code: 'NOT_FOUND', message: scope.message }
  }

  const ctx = await loadCommsExecutionContext(input.portal)
  const coreAccess = resolveCommsExecutionCoreAccess(ctx)
  const coreBlocked = (() => {
    if (coreAccess === 'proceed') return null
    if (coreAccess.state === 'available') return null
    return { reasonCode: coreAccess.reasonCode, message: coreAccess.message }
  })()
  const integrationBlocked = resolveCommsIntegrationSliceAccess(ctx)

  let inboxVisibility: CommsExecutionSummaryResponse['inboxVisibility'] = unavailable(
    'comms.inbox_visibility',
    'DATA_UNAVAILABLE',
    'Inbox visibility is temporarily unavailable',
  )
  if (coreBlocked) {
    inboxVisibility = unavailable('comms.inbox_visibility', coreBlocked.reasonCode, coreBlocked.message)
  } else {
    try {
      const inboxes = await listAccountInboxes({ customerAccountId })
      const conversationMappingCount = await prisma.chatwootConversationMapping.count({
        where: { customerAccountId },
      })
      if (inboxes.ok) {
        const visibleInboxCount = inboxes.value.inboxes.filter(
          (row) => row.visibilityState === 'VERIFIED' || row.visibilityState === 'STALE_SYNC',
        ).length
        inboxVisibility = {
          status: 'AVAILABLE',
          sourceModule: 'comms.inbox_visibility',
          data: {
            inboxCount: inboxes.value.inboxes.length,
            visibleInboxCount,
            conversationMappingCount,
            isolationBoundary: 'CUSTOMER_ACCOUNT',
            billingGroupDoesNotGrantSiblingAccess: true,
          },
        }
      }
    } catch (error) {
      if (!isPrismaMissingTableError(error)) throw error
      inboxVisibility = unavailable(
        'comms.inbox_visibility',
        'DATA_UNAVAILABLE',
        'Inbox visibility data unavailable',
      )
    }
  }

  let chatwootReadiness: CommsExecutionSummaryResponse['chatwootReadiness'] = unavailable(
    'comms.chatwoot_readiness',
    'NOT_CONFIGURED',
    'Chatwoot readiness unavailable',
  )
  if (integrationBlocked) {
    chatwootReadiness = unavailable(
      'comms.chatwoot_readiness',
      integrationBlocked.reasonCode,
      integrationBlocked.message,
    )
  } else {
    try {
      const readiness = await buildChatwootIntegrationReadiness(customerAccountId)
      if (!readiness.ok) {
        chatwootReadiness = unavailable('comms.chatwoot_readiness', readiness.code, readiness.message)
      } else {
        chatwootReadiness = {
          status: 'AVAILABLE',
          sourceModule: 'comms.chatwoot_readiness',
          data: {
            assessedAt: readiness.value.assessedAt,
            moduleEnabled: readiness.value.moduleEnabled,
            chatwootApiEnabled: readiness.value.chatwootApiEnabled,
            webhookIngestEnabled: readiness.value.webhookIngestEnabled,
            inboxCount: readiness.value.inboxCount,
            verifiedInboxCount: readiness.value.verifiedInboxCount,
            conversationMappingCount: readiness.value.conversationMappingCount,
            syncState: readiness.value.syncState,
            dispatchBlockedMessage: readiness.value.dispatchBlockedMessage,
          },
        }
      }
    } catch (error) {
      if (!isPrismaMissingTableError(error)) {
        chatwootReadiness = unavailable(
          'comms.chatwoot_readiness',
          'SOURCE_UNAVAILABLE',
          'Chatwoot readiness could not be assessed',
        )
      } else {
        chatwootReadiness = unavailable(
          'comms.chatwoot_readiness',
          'DATA_UNAVAILABLE',
          'Chatwoot readiness data unavailable',
        )
      }
    }
  }

  let messagingProviderReadiness: CommsExecutionSummaryResponse['messagingProviderReadiness'] = unavailable(
    'comms.messaging_provider_readiness',
    'DATA_UNAVAILABLE',
    'Messaging provider readiness unavailable',
  )
  if (coreBlocked) {
    messagingProviderReadiness = unavailable(
      'comms.messaging_provider_readiness',
      coreBlocked.reasonCode,
      coreBlocked.message,
    )
  } else {
    try {
      const messaging = await buildMessagingProviderReadiness(customerAccountId)
      messagingProviderReadiness = {
        status: 'AVAILABLE',
        sourceModule: 'comms.messaging_provider_readiness',
        data: {
          assessedAt: messaging.value.assessedAt,
          twilioAdapterEnabled: messaging.value.twilioAdapterEnabled,
          resendTransportEnabled: messaging.value.resendTransportEnabled,
          smsSendEnabled: messaging.value.smsSendEnabled,
          emailSendEnabled: messaging.value.emailSendEnabled,
          senders: messaging.value.senders,
          liveDispatchBlocked: true,
        },
      }
    } catch (error) {
      if (!isPrismaMissingTableError(error)) throw error
      messagingProviderReadiness = unavailable(
        'comms.messaging_provider_readiness',
        'DATA_UNAVAILABLE',
        'Messaging provider readiness data unavailable',
      )
    }
  }

  let walletGroupBoundary: CommsExecutionSummaryResponse['walletGroupBoundary'] = unavailable(
    'comms.wallet_group_boundary',
    'DATA_UNAVAILABLE',
    'Wallet boundary unavailable',
  )
  if (coreBlocked) {
    walletGroupBoundary = unavailable(
      'comms.wallet_group_boundary',
      coreBlocked.reasonCode,
      coreBlocked.message,
    )
  } else {
    try {
      const membership = await prisma.billingGroupMembership.findFirst({
        where: { customerAccountId, status: 'ACTIVE', walletUseAllowed: true },
        select: { billingGroupId: true },
        orderBy: { validFrom: 'desc' },
      })
      let availableCredits: number | null = null
      if (membership) {
        const wallet = await prisma.creditWallet.findUnique({
          where: {
            billingGroupId_creditType: {
              billingGroupId: membership.billingGroupId,
              creditType: 'MESSAGING',
            },
          },
          select: { id: true },
        })
        if (wallet) {
          const balance = await getWalletBalance(prisma, wallet.id, now)
          availableCredits = balance?.availableBalance ?? null
        }
      }
      walletGroupBoundary = {
        status: 'AVAILABLE',
        sourceModule: 'comms.wallet_group_boundary',
        data: {
          walletCommsIntegrationEnabled: isWalletCommsIntegrationEnabled(),
          walletReservationEnabled: isWalletReservationEnabled(),
          billingGroupId: membership?.billingGroupId ?? null,
          availableCredits,
          creditType: membership ? 'MESSAGING' : null,
          attributionBoundary: 'ORIGIN_CUSTOMER_ACCOUNT',
          siblingCrmAccessGranted: false,
          note: 'Billing-group wallet sharing does not grant sibling CRM, conversation, consent, or sender access.',
        },
      }
    } catch (error) {
      if (!isPrismaMissingTableError(error)) throw error
      walletGroupBoundary = unavailable(
        'comms.wallet_group_boundary',
        'DATA_UNAVAILABLE',
        'Wallet boundary data unavailable',
      )
    }
  }

  const outboundPolicyGates: CommsExecutionSummaryResponse['outboundPolicyGates'] = coreBlocked
    ? unavailable('comms.outbound_policy_gates', coreBlocked.reasonCode, coreBlocked.message)
    : {
        status: 'AVAILABLE',
        sourceModule: 'comms.outbound_policy_gates',
        data: {
          integrationGatesEnabled: !integrationBlocked,
          outboundEnabled: isCommunicationsOutboundEnabled(),
          smsSendEnabled: isSmsSendEnabled(),
          emailSendEnabled: isEmailSendEnabled(),
          chatwootDirectSendBlocked: true,
          healthcareUnapprovedProviderBlocked: true,
          preparationOnly: true,
        },
      }

  const dispatchPolicy: CommsExecutionSummaryResponse['dispatchPolicy'] = {
    status: 'AVAILABLE',
    sourceModule: 'comms.dispatch_policy',
    data: {
      dispatchBlocked: true,
      dispatchBlockedCode: PREPARATION_ONLY_DISPATCH_BLOCKED_CODE,
      dispatchBlockedMessage: PREPARATION_ONLY_DISPATCH_BLOCKED_MESSAGE,
      handoffMode: 'PREPARATION_ONLY',
      chatwootNativeSendBlocked: true,
    },
  }

  return {
    ok: true,
    value: {
      customerAccountId,
      managedSiteId: scope.managedSiteId,
      assembledAt: now.toISOString(),
      accountScope: 'session_membership',
      batchVersion: COMMS_EXECUTION_BATCH_VERSION,
      provenanceNotice: COMMS_EXECUTION_PROVENANCE_NOTICE,
      planningDisclosure: COMMS_EXECUTION_PLANNING_DISCLOSURE,
      inboxVisibility,
      chatwootReadiness,
      messagingProviderReadiness,
      walletGroupBoundary,
      outboundPolicyGates,
      dispatchPolicy,
    },
  }
}
