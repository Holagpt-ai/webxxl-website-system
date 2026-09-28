import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getIndustries, getIndustry } from '@/content/industries'
import { localeCodes } from '@/lib/i18n/config'
import { resolveLocale } from '@/lib/i18n/server'
import { IndustryPage, industryMetadata } from '@/components/templates/industry-page'

type Props = { params: Promise<{ locale: string; slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return localeCodes.flatMap((locale) => getIndustries().map((i) => ({ locale, slug: i.slug })))
}

async function load(params: Props['params']) {
  const locale = await resolveLocale(params)
  const { slug } = await params
  const industry = getIndustry(slug)
  if (!industry) notFound()
  return { locale, industry }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, industry } = await load(params)
  return industryMetadata(industry, locale)
}

export default async function IndustryDetailPage({ params }: Props) {
  const { locale, industry } = await load(params)
  return <IndustryPage industry={industry} locale={locale} />
}
