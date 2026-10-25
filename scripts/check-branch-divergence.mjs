#!/usr/bin/env node
/**
 * Advisory only. A branch behind origin/main prints a warning and exits 0.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function classifyDivergence(behind, ahead) {
  if (behind > 0) {
    return { warning: true, message: `Branch is ${behind} commit(s) behind origin/main and ${ahead} ahead. Rebase or merge main before review.` };
  }
  return { warning: false, message: `Branch is not behind origin/main (${ahead} commit(s) ahead).` };
}

function count(root, range) {
  const output = execFileSync('git', ['rev-list', '--count', range], { cwd: root, encoding: 'utf8' }).trim();
  return Number(output);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] || process.cwd());
  try {
    execFileSync('git', ['rev-parse', '--verify', 'origin/main'], { cwd: root, stdio: 'ignore' });
    const behind = count(root, 'HEAD..origin/main');
    const ahead = count(root, 'origin/main..HEAD');
    const result = classifyDivergence(behind, ahead);
    const line = result.warning ? `::warning::${result.message}` : result.message;
    process.stdout.write(`${line}\n`);
  } catch {
    process.stdout.write('::warning::Branch divergence was not computed because origin/main is unavailable.\n');
  }
}
