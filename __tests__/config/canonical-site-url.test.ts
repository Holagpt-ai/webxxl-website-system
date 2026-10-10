import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

/** Matches the one-b domain without matching the canonical two-b domain. */
const INCORRECT_DOMAIN = /(?<!b)webxxl\.com/

describe('canonical site URL', () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else process.env.NEXT_PUBLIC_SITE_URL = original
    vi.resetModules()
  })

  it('falls back to https://www.webbxxl.com when NEXT_PUBLIC_SITE_URL is absent', async () => {
    vi.resetModules()
    delete process.env.NEXT_PUBLIC_SITE_URL
    const { siteConfig } = await import('@/config/site')
    expect(siteConfig.url).toBe('https://www.webbxxl.com')
    expect(siteConfig.url).not.toMatch(INCORRECT_DOMAIN)
    expect(siteConfig.url).not.toBe('https://www.webxxl.com')
  })

  it('does not use the incorrect domain in canonical site configuration', () => {
    const source = readFileSync(resolve(process.cwd(), 'config/site.ts'), 'utf8')
    expect(source).toContain('https://www.webbxxl.com')
    expect(source).not.toContain('https://www.webxxl.com')
    expect(source).not.toMatch(INCORRECT_DOMAIN)
  })
})
