import { isTwilioAdapterEnabled, isWalletProviderMockTransportAllowed } from '@/config/wallet-backend'
import { estimateMessagingCost } from '@/lib/platform/wallet/rate-plan'
import type { ProviderAuthContext, ProviderResult, SmsProvider } from '@/lib/platform/providers/types'
import type { HttpJsonTransport, MessagingSmsAdapter, TransportLifecycleStatus } from '@/lib/platform/providers/messaging-transport'

function notConfigured<T>(message: string): ProviderResult<T> {
  return { ok: false, code: 'NOT_CONFIGURED', message }
}

export function createTwilioSmsProvider(options?: {
  transport?: HttpJsonTransport
  accountSidRef?: string
}): SmsProvider & MessagingSmsAdapter {
  const transport = options?.transport

  return {
    kind: 'sms',
    key: 'twilio',
    displayName: 'Twilio',
    availability: 'CANDIDATE',
    replaceable: true,
    installed: false,

    async send() {
      return notConfigured('Live Twilio SMS dispatch remains disabled in WALLET-09.')
    },

    async describeStatus(context) {
      if (!context.customerAccountId) {
        return { ok: false, code: 'UNAUTHORIZED', message: 'Customer account required' }
      }
      if (!isTwilioAdapterEnabled()) {
        return { ok: true, value: { status: 'NOT_CONFIGURED' } }
      }
      return { ok: true, value: { status: 'NOT_CONFIGURED' } }
    },

    async prepareSend(context, input) {
      if (!context.customerAccountId) {
        return { ok: false, code: 'UNAUTHORIZED', message: 'Customer account required' }
      }
      if (!isTwilioAdapterEnabled()) {
        return notConfigured('Twilio adapter flag is off')
      }
      const estimate = estimateMessagingCost({
        channel: 'SMS',
        providerKey: 'twilio',
        body: input.body,
      })
      if (!estimate.ok) {
        return { ok: false, code: 'UNAVAILABLE', message: 'Cost estimate unavailable' }
      }

      const externalRequest = {
        To: input.to,
        From: input.senderRef,
        Body: input.body,
        MessagingServiceSid: input.messagingTenantRef,
      }

      if (transport && isWalletProviderMockTransportAllowed()) {
        const response = await transport.postJson(
          'https://api.twilio.com/2010-04-01/Accounts/mock/Messages.json',
          { 'Content-Type': 'application/x-www-form-urlencoded' },
          externalRequest,
        )
        const sid =
          typeof response.json === 'object' && response.json && 'sid' in response.json
            ? String((response.json as { sid: string }).sid)
            : undefined
        return {
          ok: true,
          value: {
            status: response.status >= 200 && response.status < 300 ? 'ACCEPTED' : 'FAILED',
            fromRef: input.senderRef,
            to: input.to,
            body: input.body,
            segmentEstimate: estimate.value.estimatedUnits,
            externalRequest,
            externalMessageRef: sid,
            rateMetadata: {
              rateVersion: estimate.value.rateVersion,
              creditsEstimate: estimate.value.estimatedTotalCredits,
            },
          },
        }
      }

      return {
        ok: true,
        value: {
          status: 'PREPARED',
          fromRef: input.senderRef,
          to: input.to,
          body: input.body,
          segmentEstimate: estimate.value.estimatedUnits,
          externalRequest,
          rateMetadata: {
            rateVersion: estimate.value.rateVersion,
            creditsEstimate: estimate.value.estimatedTotalCredits,
          },
        },
      }
    },

    mapProviderStatus(raw: string): TransportLifecycleStatus {
      const normalized = raw.toLowerCase()
      if (normalized === 'delivered') return 'DELIVERED'
      if (normalized === 'sent' || normalized === 'queued') return 'ACCEPTED'
      if (normalized === 'failed' || normalized === 'undelivered') return 'FAILED'
      return 'UNKNOWN'
    },
  }
}
