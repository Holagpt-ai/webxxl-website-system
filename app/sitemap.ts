import type { MetadataRoute } from 'next'
import { siteConfig } from '@/config/site'
import { isEnabled } from '@/config/features'
import { getPosts } from '@/content/blog'
import { getCaseStudies } from '@/content/case-studies'
import { getIndustries } from '@/content/industries'
import { legalDocuments } from '@/content/legal'
import { getServices } from '@/content/services'
import { localeCodes } from '@/lib/i18n/config'
import { localizePath } from '@/lib/i18n/localize'

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = ['/', '/solutions', '/industries', '/crm', '/hosting', '/domains', '/case-studies', '/blog', '/pricing', '/about', '/contact', '/get-started']
  if (isEnabled('support')) staticPaths.push('/support')

  const paths = [
    ...staticPaths,
    ...getServices().map((s) => `/solutions/${s.slug}`),
    ...getIndustries().map((i) => `/industries/${i.slug}`),
    ...getCaseStudies().map((c) => `/case-studies/${c.slug}`),
    ...getPosts().map((p) => `/blog/${p.slug}`),
    ...legalDocuments.map((d) => `/${d.slug}`),
  ]

  return paths.map((path) => ({
    url: `${siteConfig.url}${localizePath('en', path)}`,
    changeFrequency: 'weekly',
    priority: path === '/' ? 1 : 0.7,
    alternates: {
      languages: Object.fromEntries(localeCodes.map((code) => [code, `${siteConfig.url}${localizePath(code, path)}`])),
    },
  }))
}
