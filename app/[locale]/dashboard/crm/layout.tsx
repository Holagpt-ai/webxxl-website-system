import { Suspense } from 'react'
import { getPageContext } from '@/lib/i18n/server'
import { PageTitle } from '@/components/dashboard/primitives'
import { WorkspaceIntro, WorkspaceSubnav } from '@/components/crm/workspace-kit'
import { CrmLockedState } from '@/components/crm/crm-locked-state'
import { crmBase, getCrmCopy } from '@/lib/crm-ui/server'
import { crmPageLockedCopy, resolveCrmPageEntitlement } from '@/lib/platform/crm/page-entitlement'

export default async function CrmLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await getPageContext(params)
  const copy = getCrmCopy(locale)

  // Runs before any CRM UI, so every nested CRM route shares this decision.
  const entitlement = await resolveCrmPageEntitlement()

  if (!entitlement.renderWorkspace || entitlement.state !== 'eligible') {
    const lockedCopy = crmPageLockedCopy(entitlement, locale === 'es' ? 'es' : 'en')
    const state = entitlement.state === 'eligible' ? 'unavailable' : entitlement.state
    return (
      <>
        <PageTitle title={copy.title} />
        {lockedCopy && <CrmLockedState state={state} copy={lockedCopy} />}
      </>
    )
  }

  const base = crmBase(locale)
  const n = copy.nav

  return (
    <>
      {entitlement.showIncludedFreeBadge && <WorkspaceIntro kit={copy.kit} workspace={copy.name} />}
      <PageTitle title={copy.title} description={copy.description} />
      <Suspense fallback={null}>
        <WorkspaceSubnav
          label={copy.kit.subnavLabel}
          items={[
            { href: base, label: n.overview, exact: true },
            { href: `${base}/contacts`, label: n.contacts },
            { href: `${base}/leads`, label: n.leads },
            { href: `${base}/leads/funnel`, label: n.leadFunnel },
            { href: `${base}/companies`, label: n.companies },
            { href: `${base}/pipeline`, label: n.pipeline },
            { href: `${base}/tasks`, label: n.tasks },
            { href: `${base}/segments`, label: n.segments },
            { href: `${base}/import`, label: n.import },
            { href: `${base}/settings`, label: n.settings },
          ]}
        />
      </Suspense>
      {children}
    </>
  )
}
