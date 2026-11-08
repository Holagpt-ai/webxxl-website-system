#!/usr/bin/env node
/**
 * Idempotent checkpoint snapshot helper (CONTINUITY-04).
 * Usage:
 *   node scripts/continuity-docs-snapshot.mjs [--print] [repo-root]
 *   node scripts/continuity-docs-snapshot.mjs --write --file snapshot.json [repo-root]
 * Does not infer migration, activation, or provider state.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseContinuityCliArgs } from './continuity-cli-args.mjs';
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

export function snapshotFromCurrentDocs(root) {
  const fields = readCurrentCheckpoint(root);
  return proposeCheckpointSnapshot({
    reconciledMainSha: fields['2']?.match(/\b([0-9a-f]{7,40})\b/i)?.[1] ?? '',
    field1Summary: fields['1'] ?? '',
    field2Summary: fields['2'] ?? '',
    field3Deployment: fields['3'] ?? '',
    field4Date: fields['4'] ?? '',
    field5Next: fields['5'] ?? '',
    field6Blockers: fields['6'] ?? '',
  });
}

export function writeCheckpointPair(root, tableMarkdown) {
  let changed = false;
  for (const rel of ['docs/PROJECT_MEMORY.md', 'docs/SESSION_HANDOFF.md']) {
    const path = join(root, rel);
    const before = readFileSync(path, 'utf8');
    const updated = applyCheckpointTable(before, tableMarkdown);
    if (!updated) throw new Error(`${rel}: canonical checkpoint block not found`);
    if (updated !== before) {
      writeFileSync(path, updated);
      changed = true;
    }
  }
  return { changed, idempotent: !changed };
}

export function applySnapshotFromFile(root, snapshotPath) {
  const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  const table = snapshot.canonical_table_markdown ?? proposeCheckpointSnapshot(snapshot).canonical_table_markdown;
  return writeCheckpointPair(root, table);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { root, write, print, file } = parseContinuityCliArgs(process.argv);
  if (!existsSync(join(root, 'docs', 'PROJECT_MEMORY.md'))) {
    process.stderr.write('ERROR: docs/PROJECT_MEMORY.md missing\n');
    process.exitCode = 1;
  } else if (write) {
    if (!file) {
      process.stderr.write('ERROR: --write requires --file <snapshot.json>\n');
      process.exitCode = 1;
    } else {
      const result = applySnapshotFromFile(root, resolve(file));
      process.stdout.write(
        `WebXXL checkpoint snapshot: ${result.idempotent ? 'idempotent (unchanged)' : 'updated'} PROJECT_MEMORY + SESSION_HANDOFF\n`,
      );
    }
  } else {
    const snapshot = snapshotFromCurrentDocs(root);
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    if (!print && process.env.CONTINUITY_DOCS_SNAPSHOT_HINT !== '0') {
      process.stderr.write('Hint: use --write --file <snapshot.json> to apply an edited snapshot (owner-local only).\n');
    }
  }
}
