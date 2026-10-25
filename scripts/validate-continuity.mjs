#!/usr/bin/env node
/**
 * Required continuity files, relative links, and the ADR approval boundary.
 * Does not crawl the Master TAD for prose quality.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAdrs } from './validate-adr.mjs';

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

/** Session handoff must carry merge/migration facts and a durable next-assignment block. */
export function validateSessionHandoff(handoff) {
  const errors = [];
  for (const marker of ['Branch', 'Merged', 'Migration', 'Do NOT touch']) {
    if (!handoff.includes(marker)) errors.push(`SESSION_HANDOFF.md is missing "${marker}"`);
  }
  const nextHeading = '## Next assignment';
  const nextStart = handoff.indexOf(nextHeading);
  const templateStart = handoff.indexOf('## Handoff template', nextStart);
  const hasTemplateField = handoff.includes('Next exact assignment / owning tool');
  if (nextStart < 0 && !hasTemplateField) {
    errors.push('SESSION_HANDOFF.md must include a Next assignment section or the handoff template next-assignment field');
  }
  const nextBody =
    nextStart >= 0
      ? handoff.slice(nextStart, templateStart > nextStart ? templateStart : undefined)
      : handoff;
  const nextText = nextBody.replace(/\s+/g, ' ').trim();
  if (nextText.length < 48) {
    errors.push('SESSION_HANDOFF.md next assignment must describe the work with enough context');
  }
  if (!/\b(Cursor|v0\.app|owner)\b/i.test(nextText)) {
    errors.push('SESSION_HANDOFF.md next assignment must name the responsible platform or owner');
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
  if (!handoff) errors.push('missing docs/SESSION_HANDOFF.md');
  else errors.push(...validateSessionHandoff(handoff));
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
  errors.push(...validateAdrs(root).errors);
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
