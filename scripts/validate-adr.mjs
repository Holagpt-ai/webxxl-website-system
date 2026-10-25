#!/usr/bin/env node
/**
 * WebXXL ADR governance validation. No external dependencies, no GitHub writes.
 * Usage: node scripts/validate-adr.mjs [repository-root]
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED = [
  'id', 'title', 'status', 'date', 'decision_owner', 'approval_evidence',
  'source_decision', 'implementation_state', 'production_state',
  'supersedes', 'superseded_by',
];
const HEADINGS = [
  'Context', 'Decision', 'Options considered', 'Consequences',
  'Compatibility and safety', 'Evidence and links', 'Approval and rollout',
];
const STATES = new Set(['PROPOSED', 'DEFERRED', 'APPROVED', 'REJECTED', 'SUPERSEDED']);
const FILE_PATTERN = /^ADR-(\d{3})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;

export function validateAdrs(root) {
  const errors = [];
  const adrDir = join(root, 'docs', 'adr');
  const indexPath = join(adrDir, 'INDEX.md');
  if (!existsSync(adrDir) || !existsSync(indexPath)) {
    return { errors: ['ADR directory or INDEX.md missing'], checked: 0 };
  }
  const files = readdirSync(adrDir).filter((f) => f.startsWith('ADR-') && f.endsWith('.md'));
  const index = readFileSync(indexPath, 'utf8');
  const decisionsPath = join(root, 'docs', 'platform', 'docs', '15-DECISIONS-CHANGELOG.md');
  const decisions = existsSync(decisionsPath) ? readFileSync(decisionsPath, 'utf8') : '';
  const ids = new Set();
  const indexRecords = new Map();
  for (const line of index.split(/\r?\n/)) {
    const match = line.match(/^\|\s*(ADR-\d{3})\s*\|/);
    if (match) indexRecords.set(match[1], (indexRecords.get(match[1]) || 0) + 1);
  }

  for (const name of files) {
    const m = name.match(FILE_PATTERN);
    if (!m) { errors.push(`${name}: invalid numbered ADR filename`); continue; }
    const id = `ADR-${m[1]}`;
    if (Number(m[1]) < 18) errors.push(`${name}: ADR-001..017 reserved for legacy decision log`);
    if (ids.has(id)) errors.push(`${name}: duplicate ID ${id}`);
    ids.add(id);
    const raw = readFileSync(join(adrDir, name), 'utf8');
    const front = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    if (!front) { errors.push(`${name}: YAML-like frontmatter missing`); continue; }
    const fields = {};
    for (const ln of front[1].split(/\r?\n/)) {
      const found = ln.match(/^([a-z_]+):\s*(.*?)\s*$/);
      if (!found) { errors.push(`${name}: invalid metadata line ${ln}`); continue; }
      if (Object.hasOwn(fields, found[1])) errors.push(`${name}: duplicate metadata field ${found[1]}`);
      fields[found[1]] = found[2].replace(/^(["'])(.*)\1$/, '$2');
    }
    for (const key of REQUIRED) if (!fields[key]) errors.push(`${name}: missing ${key}`);
    if (fields.id !== id) errors.push(`${name}: id must be ${id}`);
    if (!STATES.has(fields.status)) errors.push(`${name}: unknown status ${fields.status}`);
    if (fields.date && (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date) || Number.isNaN(Date.parse(`${fields.date}T00:00:00Z`)))) {
      errors.push(`${name}: invalid date ${fields.date}`);
    }
    if (['APPROVED', 'REJECTED', 'SUPERSEDED'].includes(fields.status) && (!fields.approval_evidence || fields.approval_evidence === 'NONE')) {
      errors.push(`${name}: ${fields.status} requires non-NONE owner decision evidence`);
    }
    if (fields.status === 'APPROVED') {
      const evidence = fields.approval_evidence ?? '';
      const citedInLog =
        decisions.includes(fields.id)
        || (evidence !== 'NONE' && evidence.length > 0 && decisions.includes(evidence));
      if (!citedInLog) {
        errors.push(`${name}: APPROVED requires ${fields.id} or approval_evidence in 15-DECISIONS-CHANGELOG.md`);
      }
    }
    if (fields.status === 'SUPERSEDED' && (!fields.superseded_by || fields.superseded_by === 'NONE')) {
      errors.push(`${name}: SUPERSEDED requires superseded_by`);
    }
    for (const heading of HEADINGS) {
      if (!raw.includes(`## ${heading}`)) errors.push(`${name}: missing heading "## ${heading}"`);
    }
    if ((indexRecords.get(id) || 0) !== 1) errors.push(`${name}: ${id} must appear exactly once as an INDEX.md table row`);
    if (!index.includes(`(${name})`)) errors.push(`${name}: INDEX.md lacks link to exact file`);
  }
  for (const [id, count] of indexRecords) {
    if (!ids.has(id)) errors.push(`INDEX.md: ${id} has row but no matching file`);
    if (count !== 1) errors.push(`INDEX.md: duplicate index rows for ${id}`);
  }
  return { errors, checked: files.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] || process.cwd());
  const result = validateAdrs(root);
  for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
  process.stdout.write(`WebXXL ADR validation: ${result.checked} records; ${result.errors.length} errors\n`);
  if (result.errors.length) process.exitCode = 1;
}
