import { cookies } from 'next/headers'

export const ACTIVE_MANAGED_SITE_COOKIE = 'webxxl_active_managed_site'

export type ManagedSiteChoice = {
  id: string
  name: string
  projectId: string | null
  updatedAt: Date
}

export function pickActiveManagedSite<T extends ManagedSiteChoice>(
  sites: T[],
  activeManagedSiteId: string | undefined | null,
  preferredProjectId?: string | null,
): { site: T | null; shouldRefreshCookie: boolean } {
  if (sites.length === 0) {
    return { site: null, shouldRefreshCookie: Boolean(activeManagedSiteId) }
  }

  const ordered = [...sites].sort((a, b) => {
    const byUpdated = b.updatedAt.getTime() - a.updatedAt.getTime()
    if (byUpdated !== 0) return byUpdated
    return a.name.localeCompare(b.name)
  })

  if (activeManagedSiteId) {
    const match = sites.find((site) => site.id === activeManagedSiteId)
    if (match) return { site: match, shouldRefreshCookie: false }
    return { site: pickPreferredOrFirst(ordered, preferredProjectId), shouldRefreshCookie: true }
  }

  return { site: pickPreferredOrFirst(ordered, preferredProjectId), shouldRefreshCookie: false }
}

function pickPreferredOrFirst<T extends ManagedSiteChoice>(ordered: T[], preferredProjectId?: string | null): T {
  if (preferredProjectId) {
    const linked = ordered.find((site) => site.projectId === preferredProjectId)
    if (linked) return linked
  }
  return ordered[0]
}

export async function getActiveManagedSiteIdFromCookie(): Promise<string | undefined> {
  const store = await cookies()
  return store.get(ACTIVE_MANAGED_SITE_COOKIE)?.value
}

export async function setActiveManagedSiteCookie(managedSiteId: string): Promise<void> {
  const store = await cookies()
  store.set(ACTIVE_MANAGED_SITE_COOKIE, managedSiteId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })
}

export async function clearActiveManagedSiteCookie(): Promise<void> {
  const store = await cookies()
  store.delete(ACTIVE_MANAGED_SITE_COOKIE)
}