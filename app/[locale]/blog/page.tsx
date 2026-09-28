import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isEnabled } from '@/config/features'
import { blogCategories, getCategory, getPosts } from '@/content/blog'
import { blogPage } from '@/content/pages'
import { getPageContext, resolveLocale } from '@/lib/i18n/server'
import { t } from '@/lib/i18n/localize'
import { buildMetadata } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { LocaleLink, Section } from '@/components/site/primitives'
import { PageHero } from '@/components/blocks/page-hero'
import { PostCard } from '@/components/blocks/cards'
import { CtaBand } from '@/components/blocks/cta-band'

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ category?: string }> }

export async function generateMetadata({ params }: { params: Props['params'] }): Promise<Metadata> {
  const locale = await resolveLocale(params)
  return buildMetadata({ locale, path: '/blog', title: t(blogPage.eyebrow, locale), description: t(blogPage.description, locale) })
}

export default async function BlogPage({ params, searchParams }: Props) {
  if (!isEnabled('blog')) notFound()
  const { locale, dict } = await getPageContext(params)
  const { category } = await searchParams
  const active = category && getCategory(category) ? category : undefined
  const posts = getPosts(active)

  const chip = (isActive: boolean) =>
    cn(
      'inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors',
      isActive ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary hover:text-primary',
    )

  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[{ label: dict.nav.blog, href: '/blog' }]}
        eyebrow={t(blogPage.eyebrow, locale)}
        title={t(blogPage.title, locale)}
        description={t(blogPage.description, locale)}
      />
      <Section labelledBy="blog-list-title">
        <h2 id="blog-list-title" className="sr-only">
          {dict.blog.categories}
        </h2>
        <nav aria-label={dict.blog.categories}>
          <ul className="flex flex-wrap gap-2">
            <li>
              <LocaleLink locale={locale} href="/blog" className={chip(!active)} aria-current={!active ? 'page' : undefined}>
                {dict.blog.all}
              </LocaleLink>
            </li>
            {blogCategories.map((c) => (
              <li key={c.slug}>
                <LocaleLink
                  locale={locale}
                  href={`/blog?category=${c.slug}`}
                  className={chip(active === c.slug)}
                  aria-current={active === c.slug ? 'page' : undefined}
                >
                  {t(c.name, locale)}
                </LocaleLink>
              </li>
            ))}
          </ul>
        </nav>
        {posts.length === 0 ? (
          <p className="mt-10 text-muted-foreground">{dict.blog.empty}</p>
        ) : (
          <ul className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <li key={post.slug} className="flex">
                <PostCard post={post} locale={locale} />
              </li>
            ))}
          </ul>
        )}
      </Section>
      <CtaBand locale={locale} />
    </>
  )
}
