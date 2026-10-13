import { cookies } from 'next/headers'

export const ACTIVE_PROJECT_COOKIE = 'webxxl_active_project'

export type ProjectChoice = {
  id: string
  name: string
  status: string
  updatedAt: Date
}

export function pickActiveProject<T extends ProjectChoice>(
  projects: T[],
  activeProjectId: string | undefined | null,
): { project: T | null; shouldRefreshCookie: boolean } {
  if (projects.length === 0) {
    return { project: null, shouldRefreshCookie: Boolean(activeProjectId) }
  }

  const ordered = [...projects].sort((a, b) => {
    const rank = (status: string) => (status === 'ACTIVE' ? 0 : 1)
    const byStatus = rank(a.status) - rank(b.status)
    if (byStatus !== 0) return byStatus
    const byUpdated = b.updatedAt.getTime() - a.updatedAt.getTime()
    if (byUpdated !== 0) return byUpdated
    const byName = a.name.localeCompare(b.name)
    if (byName !== 0) return byName
    return a.id.localeCompare(b.id)
  })

  if (activeProjectId) {
    const match = projects.find((project) => project.id === activeProjectId)
    if (match) return { project: match, shouldRefreshCookie: false }
    return { project: ordered[0], shouldRefreshCookie: true }
  }

  return { project: ordered[0], shouldRefreshCookie: false }
}

export async function getActiveProjectIdFromCookie(): Promise<string | undefined> {
  const store = await cookies()
  return store.get(ACTIVE_PROJECT_COOKIE)?.value
}

export async function setActiveProjectCookie(projectId: string): Promise<void> {
  const store = await cookies()
  store.set(ACTIVE_PROJECT_COOKIE, projectId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })
}
