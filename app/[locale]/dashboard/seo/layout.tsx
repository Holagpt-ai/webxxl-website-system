import { Suspense } from 'react'
import { getPageContext } from '@/lib/i18n/server'
import { PageTitle } from '@/components/dashboard/primitives'
import { WorkspaceIntro, WorkspaceSubnav } from '@/components/crm/workspace-kit'
import { getSeoCopy, seoBase } from '@/lib/seo-workspace-ui/server'

export default async function SeoLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await getPageContext(params)
  const copy = getSeoCopy(locale)
  const base = seoBase(locale)
  const n = copy.nav

  return (
    <>
      <WorkspaceIntro kit={copy.kit} workspace={copy.name} />
      <PageTitle title={copy.title} description={copy.description} />
      <Suspense fallback={null}>
        <WorkspaceSubnav
          label={copy.kit.subnavLabel}
          keepParams={['site']}
          items={[
            { href: base, label: n.overview, exact: true },
            { href: `${base}/pages`, label: n.pages },
            { href: `${base}/keywords`, label: n.keywords },
            { href: `${base}/local-market`, label: n.localMarket },
            { href: `${base}/opportunities`, label: n.opportunities },
            { href: `${base}/connections`, label: n.connections },
          ]}
        />
      </Suspense>
      {children}
    </>
  )
}
