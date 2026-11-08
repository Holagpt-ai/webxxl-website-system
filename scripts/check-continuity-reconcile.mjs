#!/usr/bin/env node
/**
 * CI gate: deterministic continuity contradictions fail the build.
 * push:main uses ancestor lineage for checkpoint field 2 — not exact SHA equality with GITHUB_SHA.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContinuityLiveStatus, fetchLiveMainSha, fetchRecentlyMergedPullRequests } from './continuity-live.mjs';
import { deriveReasonCode, runContinuityLifecycle } from './continuity-lifecycle.mjs';
import { buildPostMergePendingSyncArtifact } from './post-merge-pending-sync.mjs';

const root = resolve(process.argv[2] || process.cwd());
const eventName = process.env.GITHUB_EVENT_NAME ?? '';
const githubSha = (process.env.GITHUB_SHA ?? '').toLowerCase();
const isMainPush = eventName === 'push' && (process.env.GITHUB_REF ?? '').endsWith('/main');

const { reconcile: result, payload } = runContinuityLifecycle(root, {
  phase: 'ci',
  eventName,
  isMainPush,
  ciGitHubSha: isMainPush ? githubSha || null : null,
  strictExternal: Boolean(process.env.GITHUB_ACTIONS),
  skipGitFetch: Boolean(process.env.GITHUB_ACTIONS),
  referenceMain: isMainPush ? githubSha || fetchLiveMainSha(root) : undefined,
});
result.reasonCode = deriveReasonCode(result);

for (const conflict of result.conflicts) {
  process.stderr.write(`ERROR: ${conflict}\n`);
}
for (const item of result.pending) {
  process.stdout.write(`::notice::${item}\n`);
}

const artifact = buildPostMergePendingSyncArtifact(result);
if (process.env.GITHUB_ACTIONS) {
  writeFileSync('post-merge-pending-sync.json', `${JSON.stringify(artifact, null, 2)}\n`);
  const mergedPrs = fetchRecentlyMergedPullRequests(8);
  const liveMain = isMainPush ? githubSha : fetchLiveMainSha(root);
  const liveArtifact = buildContinuityLiveStatus(
    { ...result, reasonCode: payload.reasonCode },
    liveMain,
    mergedPrs,
  );
  liveArtifact.pending_summary =
    result.status === 'PENDING_REPOSITORY_SYNC'
      ? 'Documentation checkpoint lags live main or has explicit pending sync rows — reconcile in a Cursor docs PR (no auto-merge).'
      : result.status === 'CONFLICT'
        ? 'Deterministic continuity conflict — fix before treating docs as current.'
        : 'No pending post-merge documentation gap detected at this SHA.';
  writeFileSync('continuity-live-status.json', `${JSON.stringify(liveArtifact, null, 2)}\n`);
}

process.stdout.write(`WebXXL continuity reconcile: ${result.status} (${result.conflicts.length} conflicts)\n`);
if (result.conflicts.length) process.exitCode = 1;
