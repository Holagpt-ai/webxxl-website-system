import type { Metadata } from 'next'
import { PageTitle } from '@/components/dashboard/primitives'
import { BusinessCommandCenter } from '@/components/business/command-center'
import { getBusinessCopy, getBusinessPageProps } from '@/lib/business-ui/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const copy = getBusinessCopy(locale)
  return { title: copy.title, description: copy.description }
}

export default async function BusinessCommandCenterPage({ params }: { params: Promise<{ locale: string }> }) {
  const props = await getBusinessPageProps(params)
  return (
    <>
      <PageTitle title={props.copy.title} description={props.copy.description} />
      <BusinessCommandCenter {...props} />
    </>
  )
}
