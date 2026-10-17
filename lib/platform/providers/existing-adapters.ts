import type {
  EmailProvider,
  PaymentProvider,
  ProviderAuthContext,
  ProviderResult,
  SocialPublisherProvider,
  WorkflowProvider,
} from '@/lib/platform/providers/types'

function notConfigured<T>(message: string): ProviderResult<T> {
  return { ok: false, code: 'NOT_CONFIGURED', message }
}

function requireAccount(context: ProviderAuthContext): ProviderResult<never> | null {
  if (!context.customerAccountId) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Customer account context is required' }
  }
  return null
}

/** Wraps the existing Postiz scheduler stub. Does not install or activate Postiz. */
export const existingPostizSocialProvider: SocialPublisherProvider = {
  kind: 'social',
  key: 'postiz',
  displayName: 'Postiz',
  availability: 'NOT_ACTIVATED',
  replaceable: true,
  installed: false,
  async listChannels(context) {
    const denied = requireAccount(context)
    if (denied) return denied
    return notConfigured('Postiz API activation is pending. Existing scheduler link remains unchanged.')
  },
}

/** Existing notification worker remains the workflow adapter. Hatchet is a candidate only. */
export const existingWorkerWorkflowProvider: WorkflowProvider = {
  kind: 'workflow',
  key: 'webxxl-worker',
  displayName: 'Existing WebXXL worker',
  availability: 'EXISTING_ADAPTER',
  replaceable: true,
  installed: true,
  async enqueue(context, jobType) {
    const denied = requireAccount(context)
    if (denied) return denied
    if (!jobType) return { ok: false, code: 'DENIED', message: 'Job type is required' }
    return { ok: true, value: { accepted: true } }
  },
}

/** Wraps the existing Resend email boundary. No new live sending is introduced. */
export const existingResendEmailProvider: EmailProvider = {
  kind: 'email',
  key: 'resend',
  displayName: 'Resend',
  availability: 'EXISTING_ADAPTER',
  replaceable: true,
  installed: true,
  async send(context) {
    const denied = requireAccount(context)
    if (denied) return denied
    return notConfigured('FOUND-01 does not activate transactional or marketing sends.')
  },
}

/** Extends the existing provider-neutral billing identifiers. No processor is selected. */
export const existingPaymentProvider: PaymentProvider = {
  kind: 'payment',
  key: 'none',
  displayName: 'Provider-neutral checkout',
  availability: 'EXISTING_ADAPTER',
  replaceable: true,
  installed: false,
  async startCheckout(context) {
    const denied = requireAccount(context)
    if (denied) return denied
    return notConfigured('Payment processor is not selected. Stripe, Paddle, and Lemon Squeezy remain interchangeable.')
  },
}
