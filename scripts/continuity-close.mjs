#!/usr/bin/env node
/**
 * Read-only end-of-session continuity closeout (CONTINUITY-03).
 * Usage: pnpm continuity:close
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatCloseoutReport, reconcileContinuity } from './continuity-reconcile.mjs';

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] || process.cwd());
  const eventName = process.env.GITHUB_EVENT_NAME ?? '';
  const githubSha = process.env.GITHUB_SHA ?? '';
  const result = reconcileContinuity(root, { githubSha, eventName, strictExternal: false });
  process.stdout.write(`${formatCloseoutReport(result)}\n`);
  if (result.status === 'CONFLICT') process.exitCode = 1;
  else if (result.status === 'PENDING_REPOSITORY_SYNC') process.exitCode = 2;
}
