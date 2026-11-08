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

const ADR_ID_PATTERN = /ADR-\d{3}\b/g;

function adrIdsOnLine(line) {
  return [...line.matchAll(ADR_ID_PATTERN)].map((match) => match[0]);
}

/** Explicit positive owner approval for this ADR ID on the line. */
export function lineExplicitApprovedForAdr(line, adrId) {
  if (!line.includes(adrId)) return false;
  const patterns = [
    new RegExp(`${adrId}[^\\n]*\\bAPPROVED\\b`, 'i'),
    new RegExp(`\\bAPPROVED\\b[^\\n]*${adrId}`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (!match) continue;
    const chunk = match[0];
    if (/\bNOT\s+APPROVED\b/i.test(chunk) || /\bUNAPPROVED\b/i.test(chunk)) continue;
    if (/\bPROPOSED\b/i.test(chunk)) continue;
    if (/\bREJECTED\b/i.test(chunk)) continue;
    return true;
  }
  return false;
}

/**
 * Approval evidence must approve the same ADR, not a sibling record.
 */
export function lineExplicitApprovedForEvidence(line, adrId, approvalEvidence) {
  if (!approvalEvidence || approvalEvidence === 'NONE') return false;
  if (!line.includes(approvalEvidence) || !line.includes(adrId)) return false;
  const adrs = adrIdsOnLine(line);
  if (adrs.length && !adrs.includes(adrId)) return false;
  const patterns = [
    new RegExp(`${adrId}[^\\n]*${approvalEvidence}[^\\n]*\\bAPPROVED\\b`, 'i'),
    new RegExp(`${approvalEvidence}[^\\n]*${adrId}[^\\n]*\\bAPPROVED\\b`, 'i'),
    new RegExp(`\\bAPPROVED\\b[^\\n]*${adrId}[^\\n]*${approvalEvidence}`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (!match) continue;
    const chunk = match[0];
    if (/\bNOT\s+APPROVED\b/i.test(chunk) || /\bUNAPPROVED\b/i.test(chunk)) continue;
    if (/\bPROPOSED\b/i.test(chunk)) continue;
    if (/\bREJECTED\b/i.test(chunk)) continue;
    return true;
  }
  return false;
}

/**
 * Owner approval in the canonical decision log — explicit APPROVED for this ADR ID
 * and matching approval_evidence; PROPOSED-only / REJECTED-only / NOT APPROVED do not qualify.
 */
export function adrHasApprovedCitationInDecisionLog(decisions, adrId, approvalEvidence) {
  if (!decisions || !adrId) return false;
  const lines = decisions.split(/\r?\n/);
  const idApproved = lines.some((line) => lineExplicitApprovedForAdr(line, adrId));
  if (!idApproved) return false;
  if (!approvalEvidence || approvalEvidence === 'NONE') return false;
  return lines.some((line) => lineExplicitApprovedForEvidence(line, adrId, approvalEvidence));
}

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
  const indexStatus = new Map();
  for (const line of index.split(/\r?\n/)) {
    const match = line.match(/^\|\s*(ADR-\d{3})\s*\|/);
    if (match) indexRecords.set(match[1], (indexRecords.get(match[1]) || 0) + 1);
    const row = line.match(/^\|\s*(ADR-\d{3})\s*\|[^|]*\|\s*([^|]+?)\s*\|/);
    if (row) indexStatus.set(row[1], row[2].trim().toUpperCase());
  }
  const frontmatterById = new Map();

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
      if (!adrHasApprovedCitationInDecisionLog(decisions, fields.id, evidence)) {
        errors.push(
          `${name}: APPROVED requires explicit owner approval for ${fields.id} in 15-DECISIONS-CHANGELOG.md (PROPOSED-only mention is insufficient)`,
        );
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
    const indexState = indexStatus.get(id);
    if (indexState && fields.status && indexState !== fields.status.toUpperCase()) {
      errors.push(`${name}: frontmatter status ${fields.status} disagrees with INDEX.md (${indexState})`);
    }
    frontmatterById.set(id, { name, fields });
  }
  for (const [id, count] of indexRecords) {
    if (!ids.has(id)) errors.push(`INDEX.md: ${id} has row but no matching file`);
    if (count !== 1) errors.push(`INDEX.md: duplicate index rows for ${id}`);
  }
  for (const [id, { fields }] of frontmatterById) {
    const supersededBy = fields.superseded_by;
    if (supersededBy && supersededBy !== 'NONE') {
      for (const replacer of supersededBy.split(/[;,]/).map((s) => s.trim()).filter(Boolean)) {
        const repl = frontmatterById.get(replacer);
        if (!repl) {
          errors.push(`${id}: superseded_by ${replacer} but no matching ADR file`);
          continue;
        }
        const supersedesList = (repl.fields.supersedes ?? '')
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter((s) => s && s !== 'NONE');
        if (!supersedesList.includes(id)) {
          errors.push(`${id}: superseded_by ${replacer} but ${replacer} supersedes does not reciprocate ${id}`);
        }
      }
    }
    const supersedes = fields.supersedes;
    if (!supersedes || supersedes === 'NONE') continue;
    for (const target of supersedes.split(/[;,]/).map((s) => s.trim()).filter(Boolean)) {
      const targetRecord = frontmatterById.get(target);
      if (!targetRecord) {
        errors.push(`${id}: supersedes ${target} but no matching ADR file`);
        continue;
      }
      const by = targetRecord.fields.superseded_by;
      if (!by || by === 'NONE' || !by.split(/[;,]/).map((s) => s.trim()).includes(id)) {
        errors.push(`${id}: supersedes ${target} but ${target} superseded_by does not reciprocate ${id}`);
      }
      if (targetRecord.fields.status !== 'SUPERSEDED' && fields.status === 'APPROVED') {
        errors.push(`${id}: APPROVED supersedes ${target} but ${target} is not SUPERSEDED`);
      }
    }
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
