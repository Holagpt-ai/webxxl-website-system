#!/usr/bin/env node
/**
 * Navigation targets in the registered sources must match an App Router page.
 * Dynamic segments stay in the inventory and are not flagged as broken.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const NAV_SOURCES = [
  'config/navigation.ts',
  'lib/portal/modules.ts',
  'components/admin/shell.tsx',
];

export function collectPagePaths(appDir) {
  const paths = [];
  if (!existsSync(appDir)) return paths;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'page.tsx') {
        const rel = relative(appDir, dir).split(sep).filter(Boolean);
        const unlocalized = rel[0] === '[locale]' ? rel.slice(1) : rel;
        paths.push(unlocalized.length ? `/${unlocalized.join('/')}` : '/');
      }
    }
  };
  walk(appDir);
  return paths;
}

export function collectNavHrefs(source) {
  return [...source.matchAll(/(?:route|href):\s*'(\/[^']*)'/g)].map((match) => match[1]);
}

export function validateNavHrefs(hrefs, pagePaths) {
  const pages = new Set(pagePaths);
  return hrefs.filter((href) => !pages.has(href)).map((href) => `nav target ${href} has no matching page.tsx`);
}

export function validateRoutes(root) {
  const errors = [];
  const pages = collectPagePaths(join(root, 'app'));
  if (!pages.length) errors.push('no page.tsx routes found under app/');
  const hrefs = [];
  for (const rel of NAV_SOURCES) {
    const path = join(root, rel);
    if (!existsSync(path)) {
      errors.push(`nav source missing: ${rel}`);
      continue;
    }
    hrefs.push(...collectNavHrefs(readFileSync(path, 'utf8')));
  }
  errors.push(...validateNavHrefs(hrefs, pages));
  return { errors, pages: pages.length, hrefs: hrefs.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] || process.cwd());
  const result = validateRoutes(root);
  for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
  process.stdout.write(`WebXXL route check: ${result.pages} pages, ${result.hrefs} nav targets, ${result.errors.length} errors\n`);
  if (result.errors.length) process.exitCode = 1;
}
