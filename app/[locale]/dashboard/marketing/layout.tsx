import { Suspense } from 'react'
import { getPageContext } from '@/lib/i18n/server'
import { PageTitle } from '@/components/dashboard/primitives'
import { WorkspaceIntro, WorkspaceSubnav } from '@/components/crm/workspace-kit'
import { getMarketingCopy, marketingBase } from '@/lib/marketing-studio-ui/server'

export default async function MarketingLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await getPageContext(params)
  const copy = getMarketingCopy(locale)
  const base = marketingBase(locale)
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
            { href: `${base}/requests`, label: n.requests },
            { href: `${base}/deliverables`, label: n.deliverables },
            { href: `${base}/campaigns`, label: n.campaigns },
            { href: `${base}/approvals`, label: n.approvals },
            { href: `${base}/schedule`, label: n.schedule },
            { href: `${base}/connections`, label: n.connections },
          ]}
        />
      </Suspense>
      {children}
    </>
  )
}
