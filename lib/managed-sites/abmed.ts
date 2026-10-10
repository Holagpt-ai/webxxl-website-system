/**
 * Known ABMED websites. This is profile metadata only.
 * It does not insert database rows and contains no credentials.
 * No campaign API from either site is defined in this repository, so the adapter cannot publish changes.
 */

export type AbmedManagedSiteProfile = {
  profileKey: 'abmed-aesthetics' | 'abmed-physicians-group'
  name: string
  domain: string
  canonicalUrl: string
  externalAdminUrl: string | null
  platform: 'CUSTOM'
  connectionType: 'EXTERNAL_ADMIN' | 'MANUAL'
  adapterKey: 'abmed'
  locale: 'en'
  capabilityKeys: readonly string[]
}

export const ABMED_MANAGED_SITE_PROFILES: readonly AbmedManagedSiteProfile[] = [
  {
    profileKey: 'abmed-aesthetics',
    name: 'ABMED Aesthetics',
    domain: 'abmedaesthetics.com',
    canonicalUrl: 'https://abmedaesthetics.com/',
    externalAdminUrl: 'https://abmedaesthetics.com/admin',
    platform: 'CUSTOM',
    connectionType: 'EXTERNAL_ADMIN',
    adapterKey: 'abmed',
    locale: 'en',
    capabilityKeys: ['campaigns.view', 'campaigns.manage', 'popups.view', 'popups.manage', 'content.edit', 'site.custom_work'],
  },
  {
    profileKey: 'abmed-physicians-group',
    name: 'ABMED Physicians Group',
    domain: 'abmedphysiciansgroup.com',
    canonicalUrl: 'https://abmedphysiciansgroup.com/',
    externalAdminUrl: null,
    platform: 'CUSTOM',
    connectionType: 'MANUAL',
    adapterKey: 'abmed',
    locale: 'en',
    capabilityKeys: ['campaigns.view', 'popups.view', 'content.edit', 'site.custom_work'],
  },
]

const SECRET_KEY = /secret|password|token|apikey|api_key|credential|privatekey/i

export function abmedProfilesContainSecrets(profiles: readonly AbmedManagedSiteProfile[] = ABMED_MANAGED_SITE_PROFILES): boolean {
  return profiles.some((profile) => objectHasSecret(profile))
}

function objectHasSecret(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => objectHasSecret(item))
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' && /(sk_live|sk-|bearer\s+[a-z0-9._-]{12,}|-----BEGIN)/i.test(value)
  }
  return Object.entries(value).some(([key, nested]) => SECRET_KEY.test(key) || objectHasSecret(nested))
}
