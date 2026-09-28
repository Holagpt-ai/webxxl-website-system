import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Info } from 'lucide-react'
import { getLegalDocument } from '@/content/legal'
import { resolveLocale } from '@/lib/i18n/server'
import { t } from '@/lib/i18n/localize'
import { buildMetadata } from '@/lib/seo'
import { Container } from '@/components/site/primitives'
import { Breadcrumbs } from '@/components/blocks/breadcrumbs'

type Params = Promise<{ locale: string }>

const reviewNotice = {
  en: 'Placeholder text pending legal review. This is not the final policy.',
  es: 'Texto provisional pendiente de revisión legal. Esta no es la política final.',
}
const updatedLabel = { en: 'Last updated', es: 'Última actualización' }

/** Builds route exports for a legal document at /{slug}. */
export function createLegalRoute(slug: string) {
  async function load(params: Params) {
    const locale = await resolveLocale(params)
    const doc = getLegalDocument(slug)
    if (!doc) notFound()
    return { locale, doc }
  }

  async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { locale, doc } = await load(params)
    return buildMetadata({ locale, path: `/${doc.slug}`, title: t(doc.title, locale), description: t(doc.description, locale) })
  }

  async function Page({ params }: { params: Params }) {
    const { locale, doc } = await load(params)
    const title = t(doc.title, locale)
    return (
      <article>
        <header className="border-b bg-muted">
          <Container className="flex max-w-3xl flex-col gap-4 py-12">
            <Breadcrumbs locale={locale} items={[{ label: title, href: `/${doc.slug}` }]} />
            <h1 className="text-4xl font-extrabold tracking-tight">{title}</h1>
            <p className="leading-relaxed text-muted-foreground">{t(doc.description, locale)}</p>
            {doc.lastUpdated && (
              <p className="text-sm text-muted-foreground">
                {t(updatedLabel, locale)}: <time dateTime={doc.lastUpdated}>{doc.lastUpdated}</time>
              </p>
            )}
          </Container>
        </header>
        <Container className="flex max-w-3xl flex-col gap-8 py-12">
          <p className="flex items-start gap-3 rounded-xl border bg-secondary p-4 text-sm text-secondary-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t(reviewNotice, locale)}
          </p>
          {doc.sections.map((section) => (
            <section key={t(section.heading, 'en')} className="flex flex-col gap-2">
              <h2 className="text-xl font-bold">{t(section.heading, locale)}</h2>
              <p className="leading-relaxed text-muted-foreground">{t(section.body, locale)}</p>
            </section>
          ))}
        </Container>
      </article>
    )
  }

  return { generateMetadata, Page }
}
