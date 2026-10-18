import { isResendTransportEnabled, isWalletProviderMockTransportAllowed } from '@/config/wallet-backend'
import { estimateMessagingCost } from '@/lib/platform/wallet/rate-plan'
import type { EmailProvider, ProviderAuthContext, ProviderResult } from '@/lib/platform/providers/types'
import type { HttpJsonTransport, MessagingEmailAdapter, TransportLifecycleStatus } from '@/lib/platform/providers/messaging-transport'

function notConfigured<T>(message: string): ProviderResult<T> {
  return { ok: false, code: 'NOT_CONFIGURED', message }
}

export function createResendEmailProvider(options?: {
  transport?: HttpJsonTransport
  apiKeyRef?: string
}): EmailProvider & MessagingEmailAdapter {
  const transport = options?.transport

  return {
    kind: 'email',
    key: 'resend',
    displayName: 'Resend',
    availability: 'EXISTING_ADAPTER',
    replaceable: true,
    installed: true,

    async send() {
      return notConfigured('Live Resend dispatch remains disabled in WALLET-09 (non-PHI workflows only when activated).')
    },

    async describeStatus(context) {
      if (!context.customerAccountId) {
        return { ok: false, code: 'UNAUTHORIZED', message: 'Customer account required' }
      }
      if (!isResendTransportEnabled()) {
        return { ok: true, value: { status: 'NOT_CONFIGURED' } }
      }
      return { ok: true, value: { status: 'NOT_CONFIGURED' } }
    },

    async prepareSend(context, input) {
      if (!context.customerAccountId) {
        return { ok: false, code: 'UNAUTHORIZED', message: 'Customer account required' }
      }
      if (!isResendTransportEnabled()) {
        return notConfigured('Resend transport flag is off')
      }
      if (!input.from.endsWith(input.verifiedDomainRef)) {
        return { ok: false, code: 'DENIED', message: 'Sender must belong to the verified customer domain mapping' }
      }

      const estimate = estimateMessagingCost({
        channel: 'EMAIL',
        providerKey: 'resend',
        body: input.html,
        purpose: 'TRANSACTIONAL',
      })
      if (!estimate.ok) {
        return { ok: false, code: 'UNAVAILABLE', message: 'Cost estimate unavailable' }
      }

      const externalRequest = {
        from: input.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
      }

      if (transport && isWalletProviderMockTransportAllowed()) {
        const response = await transport.postJson(
          'https://api.resend.com/emails',
          { Authorization: 'Bearer mock', 'Content-Type': 'application/json' },
          externalRequest,
        )
        const id =
          typeof response.json === 'object' && response.json && 'id' in response.json
            ? String((response.json as { id: string }).id)
            : undefined
        return {
          ok: true,
          value: {
            status: response.status >= 200 && response.status < 300 ? 'ACCEPTED' : 'FAILED',
            from: input.from,
            to: input.to,
            subject: input.subject,
            domainRef: input.verifiedDomainRef,
            externalRequest,
            externalMessageRef: id,
          },
        }
      }

      return {
        ok: true,
        value: {
          status: 'PREPARED',
          from: input.from,
          to: input.to,
          subject: input.subject,
          domainRef: input.verifiedDomainRef,
          externalRequest,
        },
      }
    },

    mapProviderStatus(raw: string): TransportLifecycleStatus {
      const normalized = raw.toLowerCase()
      if (normalized === 'delivered') return 'DELIVERED'
      if (normalized === 'sent') return 'ACCEPTED'
      if (normalized === 'bounced' || normalized === 'failed') return 'FAILED'
      return 'UNKNOWN'
    },
  }
}
