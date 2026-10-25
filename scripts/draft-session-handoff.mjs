#!/usr/bin/env node
/**
 * Print a session-handoff draft from local Git. Does not write the handoff file.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function buildHandoffDraft(facts) {
  return [
    'Date / scope / owner:',
    `Repo / main SHA: Holagpt-ai/webxxl-website-system / ${facts.mainSha || 'UNVERIFIED'}`,
    `Branch / head SHA / PR: ${facts.branch || 'UNVERIFIED'} / ${facts.headSha || 'UNVERIFIED'} / ${facts.pr || 'UNVERIFIED'}`,
    'Merged state / production deployed SHA: fill merged state / do not copy the head SHA into production without a deployment record',
    'Migration applied? IDs + evidence or UNVERIFIED:',
    'Flag activation / providers / scheduler:',
    'Files and modules changed:',
    'Focused validation:',
    'Completed / in-progress / blocked / deferred:',
    'Next exact assignment / owning tool:',
    'Do NOT touch:',
    '',
  ].join('\n');
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] || process.cwd());
  let facts = {};
  try {
    facts = {
      branch: git(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
      headSha: git(root, ['rev-parse', 'HEAD']),
      mainSha: git(root, ['rev-parse', 'origin/main']),
      pr: 'UNVERIFIED',
    };
  } catch {
    facts = { mainSha: 'UNVERIFIED', branch: 'UNVERIFIED', headSha: 'UNVERIFIED', pr: 'UNVERIFIED' };
  }
  process.stdout.write(buildHandoffDraft(facts));
}
