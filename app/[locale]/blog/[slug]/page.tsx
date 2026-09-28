import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Info } from 'lucide-react'
import { siteConfig } from '@/config/site'
import { blogPosts, getCategory, getPost, getRelatedPosts, type BlogBlock } from '@/content/blog'
import { blogPage } from '@/content/pages'
import { localeCodes, type Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { resolveLocale } from '@/lib/i18n/server'
import { t } from '@/lib/i18n/localize'
import { routes } from '@/lib/routes'
import { buildMetadata } from '@/lib/seo'
import { CheckList, Container, Pill, Section } from '@/components/site/primitives'
import { Breadcrumbs, JsonLd } from '@/components/blocks/breadcrumbs'
import { PostCard, formatDate } from '@/components/blocks/cards'
import { CtaBand } from '@/components/blocks/cta-band'

type Props = { params: Promise<{ locale: string; slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return localeCodes.flatMap((locale) => blogPosts.filter((p) => p.enabled).map((p) => ({ locale, slug: p.slug })))
}

async function load(params: Props['params']) {
  const locale = await resolveLocale(params)
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()
  return { locale, post }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, post } = await load(params)
  return buildMetadata({ locale, path: routes.post(post.slug), title: t(post.title, locale), description: t(post.excerpt, locale) })
}

function Block({ block, locale }: { block: BlogBlock; locale: Locale }) {
  switch (block.type) {
    case 'heading':
      return <h2 className="mt-4 text-2xl font-bold">{t(block.text, locale)}</h2>
    case 'list':
      return <CheckList items={t(block.items, locale)} />
    case 'callout':
      return <p className="rounded-xl border-primary/20 bg-secondary p-5 font-medium leading-relaxed text-secondary-foreground">{t(block.text, locale)}</p>
    default:
      return <p className="text-pretty text-lg leading-relaxed">{t(block.text, locale)}</p>
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, post } = await load(params)
  const dict = getDictionary(locale)
  const category = getCategory(post.category)
  const related = getRelatedPosts(post)
  const title = t(post.title, locale)

  return (
    <>
      <article>
        <header className="bg-grid border-b">
          <Container className="flex max-w-3xl flex-col gap-5 py-12 md:py-16">
            <Breadcrumbs
              locale={locale}
              items={[
                { label: dict.nav.blog, href: '/blog' },
                { label: title, href: routes.post(post.slug) },
              ]}
            />
            {category && <Pill className="self-start">{t(category.name, locale)}</Pill>}
            <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">{title}</h1>
            <p className="text-pretty text-lg leading-relaxed text-muted-foreground">{t(post.excerpt, locale)}</p>
            <p className="text-sm text-muted-foreground">
              {dict.common.by} <span className="font-semibold text-foreground">{post.author.name}</span> · {t(post.author.role, locale)} ·{' '}
              <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, locale)}</time> · {post.readingMinutes} {dict.common.minRead}
            </p>
          </Container>
        </header>
        <Container className="flex max-w-3xl flex-col gap-6 py-12">
          {post.isSample && (
            <p className="flex items-start gap-3 rounded-xl border bg-muted p-4 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              {t(blogPage.sampleNotice, locale)}
            </p>
          )}
          {post.body.map((block, i) => (
            <Block key={i} block={block} locale={locale} />
          ))}
        </Container>
      </article>
      {related.length > 0 && (
        <Section tone="muted" labelledBy="related-posts-title">
          <h2 id="related-posts-title" className="text-2xl font-bold">
            {dict.blog.related}
          </h2>
          <ul className="mt-8 grid gap-6 md:grid-cols-3">
            {related.map((p) => (
              <li key={p.slug} className="flex">
                <PostCard post={p} locale={locale} />
              </li>
            ))}
          </ul>
        </Section>
      )}
      <CtaBand locale={locale} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: title,
          datePublished: post.publishedAt,
          author: { '@type': 'Person', name: post.author.name },
          publisher: { '@type': 'Organization', name: siteConfig.name },
        }}
      />
    </>
  )
}
