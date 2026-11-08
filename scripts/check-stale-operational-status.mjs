#!/usr/bin/env node
/**
 * Advisory only. Compares operational wording with the latest MERGED batch and
 * PR numbers recorded in docs/PROJECT_MEMORY.md. Does not read HEAD, so a
 * documentation commit can change the current SHA without a warning.
 * Prints GitHub warnings and exits 0.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'Holagpt-ai/webxxl-website-system';

function liveMergedPullRequestNumbers(limit = 30) {
  try {
    const out = execFileSync(
      'gh',
      ['pr', 'list', '--repo', REPO, '--state', 'merged', '--limit', String(limit), '--json', 'number'],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    return new Set(JSON.parse(out).map((row) => String(row.number)));
  } catch {
    return null;
  }
}

export const OPERATIONAL_DOCS = [
  'docs/SESSION_HANDOFF.md',
  'docs/ISSUE_REGISTER.md',
  'docs/CHANGELOG.md',
  'docs/CHATGPT_PROJECT_INSTRUCTIONS.md',
  'docs/DATA_AND_SERVICES.md',
  'docs/platform/docs/02-CURRENT-STATE.md',
  'docs/platform/docs/13-IMPLEMENTATION-ROADMAP.md',
];

export function isStaleOpenClaim(text) {
  if (/\bIN PR\b/.test(text)) return true;
  if (/\(in PR\)/i.test(text)) return true;
  if (/\*\*In PR:\*\*/.test(text)) return true;
  if (/\bNOT MERGED\b/.test(text) || /\bnot merged\b/.test(text) || /\bNot merged\b/.test(text)) return true;
  if (/\bno merged PR\b/i.test(text)) return true;
  if (/Merged:\s*\**NO\b/i.test(text)) return true;
  return false;
}

export function prNumbers(text) {
  return [...text.matchAll(/\bPR #(\d+)\b/g)].map((match) => match[1]);
}

/** Fenced blocks under ## Handoff template are copy-paste examples, not live status. */
export function stripInactiveHandoffExamples(markdown) {
  const normalized = (markdown || '').replace(/\r\n/g, '\n');
  const match = normalized.match(/^## Handoff template\b/im);
  if (!match || match.index === undefined) return normalized;
  const before = normalized.slice(0, match.index);
  const tail = normalized.slice(match.index).replace(/```[\s\S]*?```/g, '```\n(historical handoff template example — excluded from stale-status scan)\n```');
  return before + tail;
}

export function parseMergedCheckpoint(projectMemory) {
  const rows = [];
  for (const line of projectMemory.replace(/\r\n/g, '\n').split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 2 || !/^MERGED\b/.test(cells[1])) continue;
    rows.push({ item: cells[0], evidence: cells[2] || '' });
  }
  return rows;
}

export function latestCompletedBatch(rows) {
  let latest = null;
  for (const row of rows) {
    for (const match of row.item.matchAll(/\bBatch\s+(\d+)\b/gi)) {
      const number = Number(match[1]);
      if (latest === null || number > latest) latest = number;
    }
  }
  return latest;
}

function batchMentioned(text, batch) {
  if (!batch) return false;
  const pattern = new RegExp(`\\bBatch\\s+${batch}\\b|\\bBATCH-${batch}\\b|\\bANALYTICS-${batch}\\b`, 'i');
  return pattern.test(text);
}

function mergedHits(text, batch, prs) {
  const hits = [];
  if (batchMentioned(text, batch)) hits.push(`Batch ${batch}`);
  for (const number of prNumbers(text)) {
    if (prs.has(number)) hits.push(`PR #${number}`);
  }
  return [...new Set(hits)];
}

export function collectStaleStatusWarnings({ projectMemory, documents, handoff, liveMergedPrs = null }) {
  const rows = parseMergedCheckpoint(projectMemory || '');
  const batch = latestCompletedBatch(rows);
  const prs = new Set(rows.flatMap((row) => prNumbers(`${row.item} ${row.evidence}`)));
  if (liveMergedPrs) for (const number of liveMergedPrs) prs.add(number);
  const warnings = [];
  for (const doc of documents || []) {
    const raw = doc.text || '';
    const scanned = doc.name === 'docs/SESSION_HANDOFF.md' ? stripInactiveHandoffExamples(raw) : raw;
    const lines = scanned.replace(/\r\n/g, '\n').split('\n');
    lines.forEach((line, index) => {
      if (!isStaleOpenClaim(line)) return;
      const hits = mergedHits(line, batch, prs);
      if (!hits.length) return;
      warnings.push(`${doc.name}:${index + 1} stale open status for merged work (${hits.join(', ')})`);
    });
  }
  const normalized = (handoff || '').replace(/\r\n/g, '\n');
  for (const part of normalized.split(/^## /m)) {
    const title = (part.split('\n')[0] || '').trim();
    if (/^Handoff template\b/i.test(title)) continue;
    if (!isStaleOpenClaim(part)) continue;
    const hits = mergedHits(part, batch, prs);
    if (!hits.length) continue;
    warnings.push(`docs/SESSION_HANDOFF.md section "${title || '(preamble)'}" stale open status for merged work (${hits.join(', ')})`);
  }
  return warnings;
}

export function loadOperationalStatus(root) {
  const memoryPath = join(root, 'docs', 'PROJECT_MEMORY.md');
  const handoffPath = join(root, 'docs', 'SESSION_HANDOFF.md');
  return {
    projectMemory: existsSync(memoryPath) ? readFileSync(memoryPath, 'utf8') : '',
    handoff: existsSync(handoffPath) ? readFileSync(handoffPath, 'utf8') : '',
    liveMergedPrs: liveMergedPullRequestNumbers(),
    documents: OPERATIONAL_DOCS.filter((rel) => existsSync(join(root, rel))).map((rel) => {
      const raw = readFileSync(join(root, rel), 'utf8');
      const text = rel === 'docs/SESSION_HANDOFF.md' ? stripInactiveHandoffExamples(raw) : raw;
      return { name: rel, text };
    }),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] || process.cwd());
  if (!existsSync(join(root, 'docs', 'PROJECT_MEMORY.md'))) {
    process.stdout.write('::warning::Stale-status advisory skipped because docs/PROJECT_MEMORY.md is missing.\n');
  } else {
    const loaded = loadOperationalStatus(root);
    const warnings = collectStaleStatusWarnings(loaded);
    if (!warnings.length) process.stdout.write('Stale operational status: none\n');
    for (const warning of warnings) process.stdout.write(`::warning::${warning}\n`);
  }
}
