/** Services with a dedicated top-level marketing page instead of /solutions/{slug}. */
export const topLevelServices: Record<string, string> = {
  crm: '/crm',
  hosting: '/hosting',
  domains: '/domains',
}

export const routes = {
  service: (slug: string) => topLevelServices[slug] ?? `/solutions/${slug}`,
  industry: (slug: string) => `/industries/${slug}`,
  caseStudy: (slug: string) => `/case-studies/${slug}`,
  post: (slug: string) => `/blog/${slug}`,
  blogCategory: (slug: string) => `/blog?category=${slug}`,
}
