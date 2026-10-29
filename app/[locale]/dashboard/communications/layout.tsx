import { Suspense } from 'react'
import Link from 'next/link'
import { getPageContext } from '@/lib/i18n/server'
import { localizePath } from '@/lib/i18n/localize'
import type { Locale } from '@/lib/i18n/config'
import { PageTitle } from '@/components/dashboard/primitives'
import { WorkspaceSubnav } from '@/components/crm/workspace-kit'
import { commsBase, getCommsCopy } from '@/lib/comms-ui/server'

export default async function CommunicationsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await getPageContext(params)
  const copy = getCommsCopy(locale)
  const base = commsBase(locale)

  return (
    <>
      <PageTitle title={copy.title} description={copy.description} />
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">
        {copy.distinction}{' '}
        <Link
          href={localizePath(locale as Locale, '/dashboard/messages')}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {copy.messagesLink}
        </Link>
      </p>
      <Suspense fallback={null}>
        <WorkspaceSubnav
          label={copy.nav.label}
          items={[
            { href: base, label: copy.nav.inbox, exact: true },
            { href: `${base}/connections`, label: copy.nav.connections },
          ]}
        />
      </Suspense>
      {children}
    </>
  )
}
