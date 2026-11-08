#!/usr/bin/env node
/**
 * Read-only end-of-session continuity closeout (CONTINUITY-03).
 * Usage: pnpm continuity:close
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lifecycleExitCode, runContinuityLifecycle } from './continuity-lifecycle.mjs';

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] || process.cwd());
  const eventName = process.env.GITHUB_EVENT_NAME ?? '';
  const isMainPush = eventName === 'push' && (process.env.GITHUB_REF ?? '').endsWith('/main');
  const ciGitHubSha = isMainPush ? (process.env.GITHUB_SHA ?? '').toLowerCase() || null : null;
  const json = process.argv.includes('--json');
  const { payload, humanReport } = runContinuityLifecycle(root, {
    phase: 'close',
    eventName,
    isMainPush,
    ciGitHubSha,
    strictExternal: false,
  });
  if (json) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  else process.stdout.write(`${humanReport}\n`);
  process.exitCode = lifecycleExitCode(payload.status);
}
