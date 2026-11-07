#!/usr/bin/env node
/**
 * CI gate: deterministic continuity contradictions fail the build.
 * Does not require documentation SHA to equal the commit that contains the doc update
 * (checkpoint may intentionally name origin/main while a PR updates it).
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reconcileContinuity } from './continuity-reconcile.mjs';

const root = resolve(process.argv[2] || process.cwd());
const eventName = process.env.GITHUB_EVENT_NAME ?? '';
const githubSha = process.env.GITHUB_SHA ?? '';
const isMainPush = eventName === 'push' && (process.env.GITHUB_REF ?? '').endsWith('/main');

const result = reconcileContinuity(root, {
  githubSha: isMainPush ? githubSha : '',
  eventName: isMainPush ? 'push' : eventName,
  strictExternal: Boolean(process.env.GITHUB_ACTIONS),
});

for (const conflict of result.conflicts) {
  process.stderr.write(`ERROR: ${conflict}\n`);
}
for (const item of result.pending) {
  process.stdout.write(`::notice::${item}\n`);
}

process.stdout.write(`WebXXL continuity reconcile: ${result.status} (${result.conflicts.length} conflicts)\n`);
if (result.conflicts.length) process.exitCode = 1;
