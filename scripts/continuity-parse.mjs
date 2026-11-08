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

/** Plain `PR #N`, Markdown `[PR **#N**]`, and parenthetical `(PR #N)` forms. */
export function prNumbers(text) {
  if (!text) return [];
  const found = new Set();
  const patterns = [
    /\bPR\s*#(\d+)\b/gi,
    /\[\s*PR\s*(?:\*{1,2})?\s*#(\d+)\s*(?:\*{1,2})?\s*\]/gi,
    /\(\s*PR\s*#(\d+)\s*\)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) found.add(match[1]);
  }
  return [...found];
}

function prMentionChunk(text, pr) {
  const patterns = [
    new RegExp(`\\[\\s*PR\\s*(?:\\*{1,2})?\\s*#${pr}\\s*(?:\\*{1,2})?\\s*\\][^\\n]{0,120}`, 'i'),
    new RegExp(`\\bPR\\s*#${pr}\\b[^\\n]{0,120}`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return '';
}

/** Wording that implies a pull request is still open for owner review. */
export function looksLikeOpenPrClaim(text) {
  if (!text) return false;
  if (/\bactive PR\b/i.test(text)) return true;
  if (/\bOwner review of \[?PR\s*#\d+/i.test(text)) return true;
  if (/\bPR\s*#\d+\b[^.\n]*\bopen\b/i.test(text)) return true;
  if (/\[\s*PR\s*(?:\*{1,2})?\s*#\d+/i.test(text) && /\bopen\b/i.test(text)) return true;
  if (/\bon `feature\//i.test(text) && (/\bPR\s*#\d+/i.test(text) || /\[\s*PR\s*(?:\*{1,2})?\s*#\d+/i.test(text))) return true;
  if (/\bIN PR\b/.test(text)) {
    const numbered = prNumbers(text);
    if (!numbered.length) return true;
    for (const pr of numbered) {
      const chunk = prMentionChunk(text, pr);
      if (!chunk) continue;
      if (/\bMERGED\b/i.test(chunk)) continue;
      if (/\bIN PR\b/i.test(text) || /\bopen\b/i.test(chunk) || /\bnot merged\b/i.test(chunk)) return true;
    }
    return false;
  }
  return false;
}

function prMarkedMergedInField(text, pr) {
  const seg =
    text.match(
      new RegExp(`(?:PR\\s*#${pr}|\\[\\s*PR\\s*(?:\\*{1,2})?\\s*#${pr})[\\s\\S]{0,280}`, 'i'),
    )?.[0] ?? '';
  return /\bMERGED\b/i.test(seg) && !/\bnot merged\b/i.test(seg);
}

/** PR numbers explicitly described as open in this text (excludes MERGED mentions on the same line). */
export function openPrNumbersInText(text) {
  if (!text || !looksLikeOpenPrClaim(text)) return [];
  const candidates = prNumbers(text).filter((pr) => !prMarkedMergedInField(text, pr));
  if (/\b(?:open|not merged)\b/i.test(text)) return candidates;
  if (/\bIN PR\b/i.test(text)) return candidates.length ? candidates : [];
  return [];
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
