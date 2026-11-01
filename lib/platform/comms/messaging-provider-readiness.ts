import { isEmailSendEnabled, isSmsSendEnabled } from '@/config/comms-backend'
import { isResendTransportEnabled, isTwilioAdapterEnabled } from '@/config/wallet-backend'
import { prisma } from '@/lib/db'

export type MessagingSenderReadinessRow = {
  senderIdentityId: string
  channel: string
  displayName: string
  verificationState: string
  a2pRegistrationState?: string | null
  domainVerified?: boolean
  dispatchAllowed: boolean
  blockReason?: string
}

export type MessagingProviderReadinessDto = {
  customerAccountId: string
  assessedAt: string
  twilioAdapterEnabled: boolean
  resendTransportEnabled: boolean
  smsSendEnabled: boolean
  emailSendEnabled: boolean
  senders: MessagingSenderReadinessRow[]
  liveDispatchBlocked: true
}

function senderBlockReason(row: {
  verificationState: string
  channel: string
  revokedAt: Date | null
  registrationStatus: string
  providerSubaccountRef: string | null
}): string | undefined {
  if (row.revokedAt) return 'SENDER_REVOKED'
  if (row.verificationState !== 'VERIFIED') return 'SENDER_NOT_VERIFIED'
  if (row.channel === 'SMS') {
    if (row.registrationStatus !== 'REGISTERED' && row.registrationStatus !== 'NOT_REQUIRED') {
      return 'A2P_NOT_REGISTERED'
    }
    if (!row.providerSubaccountRef) return 'TWILIO_SUBACCOUNT_UNMAPPED'
  }
  if (row.channel === 'EMAIL' && row.registrationStatus === 'DOMAIN_UNVERIFIED') {
    return 'DOMAIN_NOT_VERIFIED'
  }
  return undefined
}

export async function buildMessagingProviderReadiness(
  customerAccountId: string,
): Promise<{ ok: true; value: MessagingProviderReadinessDto }> {
  const assessedAt = new Date()
  const senders = await prisma.senderIdentity.findMany({
    where: { customerAccountId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })

  const rows: MessagingSenderReadinessRow[] = senders.map((row) => {
    const blockReason = senderBlockReason({
      verificationState: row.verificationState,
      channel: row.channel,
      revokedAt: row.revokedAt,
      registrationStatus: row.registrationStatus,
      providerSubaccountRef: row.providerSubaccountRef,
    })
    return {
      senderIdentityId: row.id,
      channel: row.channel,
      displayName: row.senderRef,
      verificationState: row.verificationState,
      a2pRegistrationState: row.channel === 'SMS' ? row.registrationStatus : null,
      domainVerified: row.channel === 'EMAIL' ? row.registrationStatus === 'REGISTERED' : undefined,
      dispatchAllowed: blockReason === undefined && isTwilioAdapterEnabled() && isSmsSendEnabled(),
      blockReason,
    }
  })

  return {
    ok: true,
    value: {
      customerAccountId,
      assessedAt: assessedAt.toISOString(),
      twilioAdapterEnabled: isTwilioAdapterEnabled(),
      resendTransportEnabled: isResendTransportEnabled(),
      smsSendEnabled: isSmsSendEnabled(),
      emailSendEnabled: isEmailSendEnabled(),
      senders: rows.map((row) =>
        row.channel === 'EMAIL'
          ? {
              ...row,
              dispatchAllowed:
                row.blockReason === undefined && isResendTransportEnabled() && isEmailSendEnabled(),
            }
          : row,
      ),
      liveDispatchBlocked: true,
    },
  }
}
