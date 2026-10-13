import { isIP } from 'node:net'
import {
  isStaffPreviewStatus,
  isWebsitePreviewProvider,
  type StaffPreviewStatus,
  type WebsitePreviewProviderId,
} from '@/lib/website-preview/providers'

export type { StaffPreviewStatus, WebsitePreviewProviderId } from '@/lib/website-preview/providers'

const PROVIDER_HOST_SUFFIX: Record<Exclude<WebsitePreviewProviderId, 'OTHER'>, string> = {
  VERCEL: '.vercel.app',
  NETLIFY: '.netlify.app',
  CLOUDFLARE_PAGES: '.pages.dev',
}

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.internal',
])

export type ParsedWebsitePreview = {
  provider: WebsitePreviewProviderId
  displayName: string
  aliasUrl: string
  deploymentId: string
  versionLabel: string
  sourceRevision: string | null
  status: StaffPreviewStatus
}

export type PreviewParseError =
  | 'invalid_url'
  | 'invalid_deployment'
  | 'invalid_version'
  | 'invalid_provider'
  | 'invalid_status'
  | 'empty'

export function deploymentIdPattern(provider: WebsitePreviewProviderId): RegExp {
  if (provider === 'VERCEL') return /^dpl_[A-Za-z0-9]{8,80}$/
  if (provider === 'NETLIFY') return /^[a-f0-9]{16,40}$/i
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/
}

function blockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  if (!host || BLOCKED_HOSTS.has(host)) return true
  if (host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true
  if (isIP(host)) return true
  return false
}

export function validatePreviewUrl(
  raw: string,
  provider: WebsitePreviewProviderId,
): { ok: true; url: string } | { ok: false; error: 'invalid_url' } {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return { ok: false, error: 'invalid_url' }
  }
  if (url.protocol !== 'https:') return { ok: false, error: 'invalid_url' }
  if (url.username || url.password) return { ok: false, error: 'invalid_url' }
  if (url.hash) url.hash = ''
  const host = url.hostname.toLowerCase()
  if (blockedHostname(host)) return { ok: false, error: 'invalid_url' }

  const suffix = provider === 'OTHER' ? null : PROVIDER_HOST_SUFFIX[provider]
  if (suffix) {
    if (!host.endsWith(suffix) || host === suffix.slice(1)) return { ok: false, error: 'invalid_url' }
  } else if (!host.includes('.')) {
    return { ok: false, error: 'invalid_url' }
  }

  if (url.href.length > 2048) return { ok: false, error: 'invalid_url' }
  return { ok: true, url: url.href }
}

export function parseWebsitePreviewInput(input: {
  provider: string
  displayName: string
  aliasUrl: string
  deploymentId: string
  versionLabel: string
  sourceRevision?: string | null
  status: string
}): { ok: true; value: ParsedWebsitePreview } | { ok: false; error: PreviewParseError } {
  const provider = input.provider.trim()
  if (!isWebsitePreviewProvider(provider)) return { ok: false, error: 'invalid_provider' }
  const status = input.status.trim()
  if (!isStaffPreviewStatus(status)) return { ok: false, error: 'invalid_status' }

  const displayName = input.displayName.trim()
  if (!displayName || displayName.length > 120) return { ok: false, error: 'empty' }

  const url = validatePreviewUrl(input.aliasUrl, provider)
  if (!url.ok) return url

  const deploymentId = input.deploymentId.trim()
  if (!deploymentIdPattern(provider).test(deploymentId)) return { ok: false, error: 'invalid_deployment' }
  if (deploymentId === url.url) return { ok: false, error: 'invalid_deployment' }

  const versionLabel = input.versionLabel.trim()
  if (!versionLabel || versionLabel.length > 64 || /[\r\n]/.test(versionLabel)) {
    return { ok: false, error: 'invalid_version' }
  }

  const revision = input.sourceRevision?.trim() ?? ''
  if (revision && !/^[a-f0-9]{7,64}$/i.test(revision)) return { ok: false, error: 'invalid_version' }

  return {
    ok: true,
    value: {
      provider,
      displayName,
      aliasUrl: url.url,
      deploymentId,
      versionLabel,
      sourceRevision: revision || null,
      status,
    },
  }
}
