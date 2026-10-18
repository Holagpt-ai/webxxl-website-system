import {
  existingPaymentProvider,
  existingResendEmailProvider,
  existingWorkerWorkflowProvider,
} from '@/lib/platform/providers/existing-adapters'
import { createPostizSocialProvider } from '@/lib/platform/providers/postiz-social'
import { createTwentyCrmProvider } from '@/lib/platform/providers/twenty-crm'
import { createWebxxlNativeCrmProvider } from '@/lib/platform/providers/webxxl-native-crm'
import { createPaperclipWorkforceProvider } from '@/lib/platform/providers/paperclip-workforce'
import { createChatwootConversationProvider } from '@/lib/platform/providers/chatwoot-conversation'
import { createSyntheticWorkforceProvider } from '@/lib/platform/workforce/synthetic-provider'
import { createGoogleGa4SeoProvider } from '@/lib/platform/providers/google-ga4-seo'
import { createGoogleGbpSeoProvider } from '@/lib/platform/providers/google-gbp-seo'
import { createGoogleGscSeoProvider } from '@/lib/platform/providers/google-gsc-seo'
import { createGooglePlacesSeoProvider } from '@/lib/platform/providers/google-places-seo'
import type {
  AnyPlatformProvider,
  ConversationProvider,
  CrmProvider,
  DomainRegistrarProvider,
  ProviderKind,
  SeoSourceProvider,
  SmsProvider,
  VoiceAgentProvider,
  WorkforceProvider,
} from '@/lib/platform/providers/types'

function candidate<T extends AnyPlatformProvider>(provider: T): T {
  return provider
}

const webxxlNativeCrm = createWebxxlNativeCrmProvider()
const twentyCrm = createTwentyCrmProvider()

const chatwoot: ConversationProvider = createChatwootConversationProvider({
  baseUrl: process.env.CHATWOOT_BASE_URL ?? 'http://localhost:3000',
  resolveApiAccessToken: async () => null,
  resolveExternalAccountId: async () => null,
})

const syntheticWorkforce = createSyntheticWorkforceProvider()
const paperclip = createPaperclipWorkforceProvider()
const postizSocial = createPostizSocialProvider()

const twilio: SmsProvider = candidate({
  kind: 'sms',
  key: 'twilio',
  displayName: 'Twilio',
  availability: 'CANDIDATE',
  replaceable: true,
  installed: false,
  async send() {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'Live SMS sending belongs to WALLET-09. No Twilio send is enabled.' }
  },
})

const elevenLabs: VoiceAgentProvider = candidate({
  kind: 'voice',
  key: 'elevenlabs',
  displayName: 'ElevenLabs',
  availability: 'CANDIDATE',
  replaceable: true,
  installed: false,
  async startCall() {
    return { ok: false, code: 'DENIED', message: 'Outbound AI voice is feature-flagged and disabled.' }
  },
})

const liveKit: VoiceAgentProvider = candidate({
  kind: 'voice',
  key: 'livekit',
  displayName: 'LiveKit Agents',
  availability: 'CANDIDATE',
  replaceable: true,
  installed: false,
  async startCall() {
    return { ok: false, code: 'DENIED', message: 'Outbound AI voice is feature-flagged and disabled.' }
  },
})

const googleSeoAggregate: SeoSourceProvider = candidate({
  kind: 'seo',
  key: 'google-seo-sources',
  displayName: 'Google SEO and analytics APIs',
  availability: 'CANDIDATE',
  replaceable: true,
  installed: false,
  async readOverview() {
    return { ok: true, value: { status: 'NOT_CONNECTED' } }
  },
})

const googleGsc = createGoogleGscSeoProvider({
  transport: {
    async postJson() {
      return { status: 503, json: {}, errorMessage: 'Live GSC transport disabled in SEO-07' }
    },
  },
  resolveConnection: async () => null,
  resolveAccessTokenRef: async () => null,
  resolvePropertyRef: async () => null,
  resolveAuthorizedHosts: async () => [],
})

const googleGa4 = createGoogleGa4SeoProvider()
const googleGbp = createGoogleGbpSeoProvider()
const googlePlaces = createGooglePlacesSeoProvider({
  transport: {
    async postJson() {
      return { status: 503, json: {} }
    },
  },
})

const domainRegistrar: DomainRegistrarProvider = candidate({
  kind: 'domain',
  key: 'unselected-registrar',
  displayName: 'Domain registrar',
  availability: 'NOT_INSTALLED',
  replaceable: true,
  installed: false,
  async quote() {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'Domain registrar is not selected.' }
  },
})

const DEFAULT_PROVIDERS: AnyPlatformProvider[] = [
  webxxlNativeCrm,
  twentyCrm,
  chatwoot,
  postizSocial,
  syntheticWorkforce,
  paperclip,
  existingWorkerWorkflowProvider,
  twilio,
  existingResendEmailProvider,
  existingPaymentProvider,
  elevenLabs,
  liveKit,
  googleSeoAggregate,
  googleGsc,
  googleGa4,
  googleGbp,
  googlePlaces,
  domainRegistrar,
]

export class ProviderRegistry {
  private readonly providers = new Map<string, AnyPlatformProvider>()

  constructor(seed: AnyPlatformProvider[] = DEFAULT_PROVIDERS) {
    for (const provider of seed) this.register(provider)
  }

  register(provider: AnyPlatformProvider): void {
    this.providers.set(`${provider.kind}:${provider.key}`, provider)
  }

  get<T extends AnyPlatformProvider>(kind: ProviderKind, key: string): T | undefined {
    return this.providers.get(`${kind}:${key}`) as T | undefined
  }

  list(kind?: ProviderKind): AnyPlatformProvider[] {
    const all = [...this.providers.values()]
    return kind ? all.filter((provider) => provider.kind === kind) : all
  }

  requiredKindsPresent(): boolean {
    const kinds: ProviderKind[] = [
      'crm',
      'conversation',
      'social',
      'workforce',
      'workflow',
      'sms',
      'email',
      'payment',
      'voice',
      'seo',
      'domain',
    ]
    return kinds.every((kind) => this.list(kind).length > 0)
  }
}

export function createDefaultProviderRegistry(): ProviderRegistry {
  return new ProviderRegistry()
}
