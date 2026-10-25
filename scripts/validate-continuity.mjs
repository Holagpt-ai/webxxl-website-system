#!/usr/bin/env node
/**
 * Required continuity files, relative links, and the ADR approval boundary.
 * Does not crawl the Master TAD for prose quality.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_FILES = [
  'README.md',
  'AGENTS.md',
  'docs/PROJECT_MEMORY.md',
  'docs/ARCHITECTURE.md',
  'docs/ROUTE_MAP.md',
  'docs/DATA_AND_SERVICES.md',
  'docs/DEPLOYMENT_STATUS.md',
  'docs/ISSUE_REGISTER.md',
  'docs/SESSION_HANDOFF.md',
  'docs/CHANGELOG.md',
  'docs/RELEASE_GATES.md',
  'docs/CHATGPT_PROJECT_INSTRUCTIONS.md',
  'docs/adr/README.md',
  'docs/adr/INDEX.md',
  'docs/adr/TEMPLATE.md',
  'docs/platform/docs/01-MASTER-TAD.md',
  'docs/platform/docs/15-DECISIONS-CHANGELOG.md',
  '.cursor/rules/webxxl-continuity.mdc',
  '.github/pull_request_template.md',
];

const LINKED_DOCS = [
  'README.md',
  'AGENTS.md',
  'docs/PROJECT_MEMORY.md',
  'docs/ARCHITECTURE.md',
  'docs/ROUTE_MAP.md',
  'docs/DATA_AND_SERVICES.md',
  'docs/DEPLOYMENT_STATUS.md',
  'docs/ISSUE_REGISTER.md',
  'docs/SESSION_HANDOFF.md',
  'docs/CHANGELOG.md',
  'docs/RELEASE_GATES.md',
  'docs/adr/README.md',
  'docs/adr/INDEX.md',
];

export function relativeLinkErrors(root, rel) {
  const text = readFileSync(join(root, rel), 'utf8');
  const errors = [];
  for (const match of text.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const [pathPart] = target.split('#');
    if (!pathPart) continue;
    const absolute = normalize(join(root, dirname(rel), pathPart));
    if (!existsSync(absolute)) errors.push(`${rel}: broken link ${target}`);
  }
  return errors;
}

export function validateContinuity(root) {
  const errors = [];
  for (const rel of REQUIRED_FILES) {
    if (!existsSync(join(root, rel))) errors.push(`missing ${rel}`);
  }
  const readme = existsSync(join(root, 'README.md')) ? readFileSync(join(root, 'README.md'), 'utf8') : '';
  if (readme.includes('bootstrapped with')) errors.push('README.md still uses the v0 starter introduction');
  if (!readme.includes('docs/PROJECT_MEMORY.md')) errors.push('README.md must link the project memory');
  const handoff = existsSync(join(root, 'docs/SESSION_HANDOFF.md')) ? readFileSync(join(root, 'docs/SESSION_HANDOFF.md'), 'utf8') : '';
  for (const marker of ['Branch', 'Merged', 'Migration', 'Batch 15', 'Do NOT touch']) {
    if (!handoff.includes(marker)) errors.push(`SESSION_HANDOFF.md is missing "${marker}"`);
  }
  const decisions = existsSync(join(root, 'docs/platform/docs/15-DECISIONS-CHANGELOG.md'))
    ? readFileSync(join(root, 'docs/platform/docs/15-DECISIONS-CHANGELOG.md'), 'utf8')
    : '';
  for (const id of ['ADR-001', 'ADR-017']) {
    if (!decisions.includes(id)) errors.push(`decision log is missing ${id}`);
  }
  const tad = existsSync(join(root, 'docs/platform/docs/01-MASTER-TAD.md'))
    ? readFileSync(join(root, 'docs/platform/docs/01-MASTER-TAD.md'), 'utf8')
    : '';
  if (!tad.startsWith('# 01 — WebXXL Technical Architecture Document (Master TAD)')) {
    errors.push('Master TAD heading changed; this check refuses a replaced architecture document');
  }
  const adrDir = join(root, 'docs', 'adr');
  if (existsSync(adrDir)) {
    for (const name of readdirSync(adrDir)) {
      if (!/^ADR-\d{3}-.+\.md$/.test(name)) continue;
      const body = readFileSync(join(adrDir, name), 'utf8');
      if (/^status:\s*APPROVED\s*$/m.test(body)) errors.push(`${name} is APPROVED; new records in this batch must stay PROPOSED`);
    }
  }
  for (const rel of LINKED_DOCS) {
    if (existsSync(join(root, rel))) errors.push(...relativeLinkErrors(root, rel));
  }
  return { errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validateContinuity(resolve(process.argv[2] || process.cwd()));
  for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
  process.stdout.write(`WebXXL continuity check: ${result.errors.length} errors\n`);
  if (result.errors.length) process.exitCode = 1;
}
