#!/usr/bin/env node
/**
 * Static sitemap paths, private-route exclusion, canonical helper, and noindex shells.
 * Does not execute Next.js or content collections.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectPagePaths } from './validate-routes.mjs';

const PRIVATE_PREFIXES = ['/dashboard', '/admin', '/login'];

export function extractStaticPaths(source) {
  const block = source.match(/const staticPaths = \[([\s\S]*?)\]/);
  if (!block) return null;
  return [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

export function validateStaticPaths(paths, pagePaths) {
  const pages = new Set(pagePaths);
  const errors = [];
  for (const path of paths) {
    if (PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
      errors.push(`sitemap lists private path ${path}`);
    }
    if (!pages.has(path)) errors.push(`sitemap path ${path} has no page.tsx`);
  }
  return errors;
}

export function validateSeo(root) {
  const errors = [];
  const read = (rel) => {
    const path = join(root, rel);
    if (!existsSync(path)) {
      errors.push(`missing ${rel}`);
      return '';
    }
    return readFileSync(path, 'utf8');
  };
  const sitemap = read('app/sitemap.ts');
  const robots = read('app/robots.ts');
  const seo = read('lib/seo.ts');
  const site = read('config/site.ts');
  const dashboard = read('app/[locale]/dashboard/layout.tsx');
  const admin = read('app/[locale]/admin/layout.tsx');
  const login = read('app/[locale]/login/page.tsx');
  const paths = sitemap ? extractStaticPaths(sitemap) : null;
  if (sitemap && !paths) errors.push('app/sitemap.ts is missing the staticPaths array');
  if (paths) errors.push(...validateStaticPaths(paths, collectPagePaths(join(root, 'app'))));
  if (sitemap && !sitemap.includes('siteConfig.url')) errors.push('sitemap must build URLs from siteConfig.url');
  if (robots && !robots.includes("'/login'")) errors.push('robots.ts must disallow /login');
  if (robots && !robots.includes('/sitemap.xml')) errors.push('robots.ts must point at the sitemap');
  if (seo && !seo.includes('canonical: url')) errors.push('lib/seo.ts must set a canonical URL');
  if (site && !site.includes('https://www.webbxxl.com')) errors.push('config/site.ts default URL must stay https://www.webbxxl.com');
  if (dashboard && !dashboard.includes('index: false')) errors.push('dashboard layout must be noindex');
  if (admin && !admin.includes('index: false')) errors.push('admin layout must be noindex');
  if (login && !login.includes('index: false')) errors.push('login page must be noindex');
  return { errors, staticPaths: paths?.length ?? 0 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validateSeo(resolve(process.argv[2] || process.cwd()));
  for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
  process.stdout.write(`WebXXL SEO check: ${result.staticPaths} static sitemap paths, ${result.errors.length} errors\n`);
  if (result.errors.length) process.exitCode = 1;
}
