/**
 * Parse WebXXL continuity documents (six-field checkpoint, SHAs, PR refs).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SHA_RE = /\b([0-9a-f]{7,40})\b/gi;

export function parseSixFieldCheckpoint(markdown) {
  const fields = {};
  if (!markdown) return fields;
  const anchor =
    markdown.indexOf('### Canonical checkpoint (six-field)') >= 0
      ? '### Canonical checkpoint (six-field)'
      : markdown.indexOf('## Canonical checkpoint (six-field)') >= 0
        ? '## Canonical checkpoint (six-field)'
        : '';
  const slice = anchor ? markdown.slice(markdown.indexOf(anchor)) : markdown;
  for (const line of slice.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 4 || !/^\d$/.test(cells[1])) continue;
    fields[cells[1]] = cells[3] ?? '';
  }
  return fields;
}

export function firstSha(text) {
  if (!text) return null;
  const match = text.match(/\b([0-9a-f]{7,40})\b/i);
  return match ? match[1].toLowerCase() : null;
}

export function allShas(text) {
  if (!text) return [];
  return [...text.matchAll(SHA_RE)].map((m) => m[1].toLowerCase());
}

export function prNumbers(text) {
  if (!text) return [];
  return [...text.matchAll(/\bPR\s*#(\d+)\b/gi)].map((m) => m[1]);
}

/** Wording that implies a pull request is still open for owner review. */
export function looksLikeOpenPrClaim(text) {
  if (!text) return false;
  if (/\bactive PR\b/i.test(text)) return true;
  if (/\bOwner review of \[?PR\s*#\d+/i.test(text)) return true;
  if (/\bPR\s*#\d+\b[^.\n]*\bopen\b/i.test(text)) return true;
  if (/\bon `feature\//i.test(text) && /\bPR\s*#\d+/i.test(text)) return true;
  if (/\bIN PR\b/.test(text) && /\bPR\s*#\d+/.test(text)) return true;
  return false;
}

export function readCheckpointPair(root) {
  const memoryPath = join(root, 'docs', 'PROJECT_MEMORY.md');
  const handoffPath = join(root, 'docs', 'SESSION_HANDOFF.md');
  const projectMemory = existsSync(memoryPath) ? readFileSync(memoryPath, 'utf8') : '';
  const sessionHandoff = existsSync(handoffPath) ? readFileSync(handoffPath, 'utf8') : '';
  return {
    projectMemory,
    sessionHandoff,
    memoryFields: parseSixFieldCheckpoint(projectMemory),
    handoffFields: parseSixFieldCheckpoint(sessionHandoff),
  };
}

export function parsePendingRepositorySync(handoff) {
  const heading = '## PENDING REPOSITORY SYNC';
  const start = handoff.indexOf(heading);
  if (start < 0) return { items: [], raw: '' };
  const rest = handoff.slice(start + heading.length);
  const end = rest.search(/\n## /);
  const body = (end >= 0 ? rest.slice(0, end) : rest).trim();
  const items = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '(none)' || /^-\s*\(none\)/i.test(trimmed)) continue;
    if (trimmed.startsWith('-') || trimmed.startsWith('|')) items.push(trimmed);
  }
  return { items, raw: body };
}

export function shasPrefixMatch(a, b) {
  if (!a || !b) return false;
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x.startsWith(y) || y.startsWith(x);
}
