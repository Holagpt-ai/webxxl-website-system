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
import { routes, topLevelServices } from '@/lib/routes'

/** Top-level service routes that are gated by a feature flag. */
const serviceRouteFlags: Partial<Record<string, Parameters<typeof isEnabled>[0]>> = {
  crm: 'crmMarketing',
}

function serviceIsIndexable(slug: string): boolean {
  const flag = serviceRouteFlags[slug]
  return flag ? isEnabled(flag) : true
}

export default function sitemap(): MetadataRoute.Sitemap {
  const services = getServices().filter((s) => serviceIsIndexable(s.slug))

  const paths = [
    '/',
    '/solutions',
    '/industries',
    '/about',
    '/contact',
    '/get-started',
    ...(isEnabled('pricing') ? ['/pricing'] : []),
    ...(isEnabled('support') ? ['/support'] : []),
    // routes.service resolves crm/hosting/domains to their canonical top-level URL.
    ...services.map((s) => routes.service(s.slug)),
    ...getIndustries().map((i) => routes.industry(i.slug)),
    ...(isEnabled('caseStudies') ? ['/case-studies', ...getCaseStudies().map((c) => routes.caseStudy(c.slug))] : []),
    ...(isEnabled('blog') ? ['/blog', ...getPosts().map((p) => routes.post(p.slug))] : []),
    ...legalDocuments.map((d) => `/${d.slug}`),
  ]

  const unique = [...new Set(paths)].filter(
    (path) => !(path.startsWith('/solutions/') && path.slice('/solutions/'.length) in topLevelServices),
  )

  return unique.map((path) => ({
    url: `${siteConfig.url}${localizePath('en', path)}`,
    changeFrequency: 'weekly',
    priority: path === '/' ? 1 : 0.7,
    alternates: {
      languages: Object.fromEntries(localeCodes.map((code) => [code, `${siteConfig.url}${localizePath(code, path)}`])),
    },
  }))
}
