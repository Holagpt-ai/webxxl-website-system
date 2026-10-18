/**
 * INFRA-02 — staging endpoint contract (no secrets, no live activation).
 */

export type IsolatedServiceKey = 'chatwoot' | 'postiz_staging' | 'paperclip' | 'postiz_production_candidate'

export type IsolatedServiceDescriptor = {
  key: IsolatedServiceKey
  composeProject: string
  defaultLocalBaseUrl: string
  activated: false
  notes: string
}

export const ISOLATED_SERVICE_DESCRIPTORS: readonly IsolatedServiceDescriptor[] = [
  {
    key: 'chatwoot',
    composeProject: 'webxxl-stg-chatwoot',
    defaultLocalBaseUrl: 'http://127.0.0.1:13000',
    activated: false,
    notes: 'ConversationProvider adapter pending COMMS-06; staging compose in infra/services/chatwoot',
  },
  {
    key: 'postiz_staging',
    composeProject: 'webxxl-stg-postiz',
    defaultLocalBaseUrl: 'http://127.0.0.1:14007',
    activated: false,
    notes: 'Requires cloned gitroomhq/postiz-docker-compose on host; do not overwrite app.webbxxl.com',
  },
  {
    key: 'paperclip',
    composeProject: 'webxxl-stg-paperclip',
    defaultLocalBaseUrl: 'http://127.0.0.1:13100',
    activated: false,
    notes: 'WorkforceProvider adapter pending AGENT-03; build from upstream tag',
  },
  {
    key: 'postiz_production_candidate',
    composeProject: 'n/a-existing-deployment',
    defaultLocalBaseUrl: 'https://app.webbxxl.com',
    activated: false,
    notes: 'Inventory-only; link-out via lib/integrations/scheduler.ts',
  },
] as const

export function readIsolatedServiceEnv(): {
  chatwootBaseUrl: string
  postizStagingBaseUrl: string
  paperclipBaseUrl: string
  postizProductionCandidateUrl: string
} {
  return {
    chatwootBaseUrl: process.env.CHATWOOT_BASE_URL ?? 'http://127.0.0.1:13000',
    postizStagingBaseUrl: process.env.POSTIZ_STAGING_BASE_URL ?? 'http://127.0.0.1:14007',
    paperclipBaseUrl: process.env.WORKFORCE_BASE_URL ?? process.env.PAPERCLIP_BASE_URL ?? 'http://127.0.0.1:13100',
    postizProductionCandidateUrl: process.env.POSTIZ_BASE_URL ?? process.env.NEXT_PUBLIC_SCHEDULER_URL ?? 'https://app.webbxxl.com',
  }
}

export function assertStagingComposeProject(service: IsolatedServiceKey, projectName: string): boolean {
  const descriptor = ISOLATED_SERVICE_DESCRIPTORS.find((d) => d.key === service)
  if (!descriptor) return false
  if (service === 'postiz_production_candidate') return projectName.startsWith('webxxl-stg-') === false
  return descriptor.composeProject === projectName
}
