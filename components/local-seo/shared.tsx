'use client'

import { useSearchParams } from 'next/navigation'
import { DisconnectedState, SiteSelector, type PillTone } from '@/components/crm/workspace-kit'
import type { ManagedSiteOption, WorkspaceKitCopy } from '@/lib/crm-ui/workspace'

export const DATA_TONE: Record<string, PillTone> = {
  NOT_CONNECTED: 'muted',
  FETCHING: 'info',
  READY: 'success',
  PARTIAL: 'neutral',
  STALE: 'neutral',
  ERROR: 'danger',
  NOT_SUPPORTED: 'muted',
}

export const LEVEL_TONE: Record<string, PillTone> = { LOW: 'muted', MEDIUM: 'neutral', HIGH: 'danger' }

/** The selected site lives in `?site=` so every SEO section keeps the same site while navigating. */
export function useSelectedSite(sites: ManagedSiteOption[]): string {
  const requested = useSearchParams().get('site')
  return requested && sites.some((s) => s.id === requested) ? requested : (sites[0]?.id ?? '')
}

export function SiteBar({
  sites,
  siteId,
  kit,
  children,
}: {
  sites: ManagedSiteOption[]
  siteId: string
  kit: WorkspaceKitCopy
  children: React.ReactNode
}) {
  if (!sites.length) return <DisconnectedState title={kit.noSites.title} body={kit.noSites.body} />
  return (
    <div className="flex flex-col gap-6">
      <SiteSelector sites={sites} selectedId={siteId} label={kit.siteLabel} />
      {children}
    </div>
  )
}
