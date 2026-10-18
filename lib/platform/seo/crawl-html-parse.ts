export type ParsedHtmlPage = {
  title?: string
  metaDescription?: string
  h1?: string
  h2: string[]
  canonical?: string
  robotsMeta?: string
  viewportMeta?: boolean
  internalLinks: string[]
  externalLinks: string[]
  structuredDataTypes: string[]
  hreflang: string[]
  missingAltCount: number
}

export function parseHtmlSeoSignals(html: string, baseUrl: string): ParsedHtmlPage {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
  const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i)
  const h2Matches = [...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/gi)].map((m) => m[1]?.trim() ?? '')
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]
  const robotsMeta = html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i)?.[1]
  const viewportMeta = /<meta[^>]+name=["']viewport["']/i.test(html)
  const ldJson = [...html.matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map((m) => m[1] ?? '')
  const hreflang = [...html.matchAll(/<link[^>]+hreflang=["']([^"']+)["']/gi)].map((m) => m[1] ?? '')
  const imgWithoutAlt = [...html.matchAll(/<img\b(?![^>]*\balt=)[^>]*>/gi)].length

  const links: string[] = []
  for (const match of html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)) {
    links.push(match[1] ?? '')
  }
  const base = new URL(baseUrl)
  const internal: string[] = []
  const external: string[] = []
  for (const href of links) {
    try {
      const u = new URL(href, baseUrl)
      if (u.hostname === base.hostname) internal.push(u.toString())
      else external.push(u.toString())
    } catch {
      // skip malformed
    }
  }

  return {
    title: titleMatch?.[1]?.trim(),
    metaDescription: metaDesc?.[1]?.trim(),
    h1: h1Match?.[1]?.trim(),
    h2: h2Matches.filter(Boolean),
    canonical,
    robotsMeta,
    viewportMeta,
    internalLinks: internal,
    externalLinks: external,
    structuredDataTypes: ldJson,
    hreflang,
    missingAltCount: imgWithoutAlt,
  }
}
