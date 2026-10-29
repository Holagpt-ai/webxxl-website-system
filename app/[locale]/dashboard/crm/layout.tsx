import { Suspense } from 'react'
import { getPageContext } from '@/lib/i18n/server'
import { PageTitle } from '@/components/dashboard/primitives'
import { WorkspaceIntro, WorkspaceSubnav } from '@/components/crm/workspace-kit'
import { crmBase, getCrmCopy } from '@/lib/crm-ui/server'

export default async function CrmLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await getPageContext(params)
  const copy = getCrmCopy(locale)
  const base = crmBase(locale)
  const n = copy.nav

  return (
    <>
      <WorkspaceIntro kit={copy.kit} workspace={copy.name} />
      <PageTitle title={copy.title} description={copy.description} />
      <Suspense fallback={null}>
        <WorkspaceSubnav
          label={copy.kit.subnavLabel}
          items={[
            { href: base, label: n.overview, exact: true },
            { href: `${base}/contacts`, label: n.contacts },
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
