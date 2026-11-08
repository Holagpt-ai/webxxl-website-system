/**
 * Idempotent proposed checkpoint snapshot (CONTINUITY-04). Read-only unless --write (local owner use).
 * Does not infer migration, activation, or provider state.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSixFieldCheckpoint } from './continuity-parse.mjs';

export function proposeCheckpointSnapshot({
  reconciledMainSha,
  field1Summary,
  field2Summary,
  field3Deployment,
  field4Date,
  field5Next,
  field6Blockers,
}) {
  const table = [
    '### Canonical checkpoint (six-field)',
    '',
    '| # | Field | Value |',
    '|---|---|---|',
    `| 1 | Last verified checkpoint | ${field1Summary} |`,
    `| 2 | GitHub SHA, branch, active PR | ${field2Summary} |`,
    `| 3 | Production deployment | ${field3Deployment} |`,
    `| 4 | Last updated | ${field4Date} |`,
    `| 5 | Next task / responsible platform | ${field5Next} |`,
    `| 6 | Open blocker / gate IDs | ${field6Blockers} |`,
  ].join('\n');
  return {
    reconciled_main_sha: reconciledMainSha,
    canonical_table_markdown: table,
    write_targets: ['docs/PROJECT_MEMORY.md', 'docs/SESSION_HANDOFF.md'],
  };
}

/** Replace the six-field table block in a markdown file (header lines preserved above anchor). */
export function applyCheckpointTable(markdown, newTableBlock) {
  const anchor = '### Canonical checkpoint (six-field)';
  const alt = '## Canonical checkpoint (six-field)';
  const idx = markdown.indexOf(anchor) >= 0 ? markdown.indexOf(anchor) : markdown.indexOf(alt);
  if (idx < 0) return null;
  const after = markdown.slice(idx);
  const end = after.search(/\n(?:## |### Evidence|\n## )/);
  const tailStart = end >= 0 ? idx + end : markdown.length;
  return `${markdown.slice(0, idx)}${newTableBlock}\n${markdown.slice(tailStart).replace(/^\n+/, '\n')}`;
}

export function readCurrentCheckpoint(root) {
  const memory = readFileSync(join(root, 'docs', 'PROJECT_MEMORY.md'), 'utf8');
  return parseSixFieldCheckpoint(memory);
}

export function writeCheckpointPair(root, tableMarkdown) {
  for (const rel of ['docs/PROJECT_MEMORY.md', 'docs/SESSION_HANDOFF.md']) {
    const path = join(root, rel);
    const updated = applyCheckpointTable(readFileSync(path, 'utf8'), tableMarkdown);
    if (!updated) throw new Error(`${rel}: canonical checkpoint block not found`);
    writeFileSync(path, updated);
  }
}
