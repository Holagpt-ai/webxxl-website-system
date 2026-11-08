#!/usr/bin/env node
/**
 * Session-start continuity check (CONTINUITY-04). Read-only.
 * Usage: pnpm continuity:start [--json]
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lifecycleExitCode, runContinuityLifecycle } from './continuity-lifecycle.mjs';

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] || process.cwd());
  const json = process.argv.includes('--json');
  const { payload, humanReport } = runContinuityLifecycle(root, {
    phase: 'start',
    strictExternal: Boolean(process.env.GITHUB_ACTIONS),
    skipGitFetch: false,
  });
  if (json) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  else process.stdout.write(`${humanReport}\n`);
  process.exitCode = lifecycleExitCode(payload.status);
}
