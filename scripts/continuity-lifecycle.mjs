/**
 * Shared CONTINUITY-04 lifecycle engine (start | checkpoint | close | ci).
 */
import { reconcileContinuity, formatCloseoutReport } from './continuity-reconcile.mjs';
import { fetchLiveMainSha, fetchRecentlyMergedPullRequests, buildContinuityLiveStatus } from './continuity-live.mjs';

export const LIFECYCLE_PHASES = ['start', 'checkpoint', 'close', 'ci'];

export function deriveReasonCode(result) {
  if (result.status === 'CONFLICT') {
    if (result.conflicts.some((c) => /still describes PR #\d+ as open/i.test(c))) return 'MERGED_PR_STILL_OPEN';
    if (result.conflicts.some((c) => /canonical checkpoint field/i.test(c))) return 'CHECKPOINT_PAIR_MISMATCH';
    if (result.conflicts.some((c) => /stale operational status/i.test(c))) return 'STALE_OPERATIONAL_CLAIM';
    if (result.conflicts.some((c) => /ADR|INDEX/i.test(c))) return 'ADR_GOVERNANCE';
    if (result.conflicts.some((c) => /02-CURRENT-STATE|CHATGPT_PROJECT/i.test(c))) return 'FALSE_CURRENT_ANCHOR';
    if (result.conflicts.some((c) => /ISSUE_REGISTER/i.test(c))) return 'ISSUE_REGISTER_DRIFT';
    return 'CONFLICT';
  }
  if (result.status === 'PENDING_REPOSITORY_SYNC') {
    if (result.pending.some((p) => /POST-MERGE-CHECKPOINT/i.test(p))) return 'CHECKPOINT_LAGS_LIVE_MAIN';
    return 'PENDING_REPOSITORY_SYNC';
  }
  return 'SYNCHRONIZED';
}

/**
 * @param {string} root
 * @param {{
 *   phase?: 'start' | 'checkpoint' | 'close' | 'ci',
 *   eventName?: string,
 *   isMainPush?: boolean,
 *   ciGitHubSha?: string | null,
 *   referenceMain?: string | null,
 *   strictExternal?: boolean,
 *   skipGitFetch?: boolean,
 * }} options
 */
export function runContinuityLifecycle(root, options = {}) {
  const phase = options.phase ?? 'ci';
  const liveMain = options.skipGitFetch ? options.referenceMain : fetchLiveMainSha(root);
  const mergedPrs = fetchRecentlyMergedPullRequests(8);
  const reconcile = reconcileContinuity(root, {
    ...options,
    lifecyclePhase: phase,
    referenceMain: options.referenceMain ?? liveMain,
    strictExternal: options.strictExternal ?? phase === 'close',
  });
  const reasonCode = deriveReasonCode(reconcile);
  const evidenceAsOf = new Date().toISOString();
  const liveStatus = buildContinuityLiveStatus({ ...reconcile, reasonCode }, liveMain, mergedPrs);

  const payload = {
    schema: 'webxxl-continuity-lifecycle-v1',
    phase,
    status: reconcile.status,
    reasonCode,
    evidenceAsOf,
    conflicts: reconcile.conflicts,
    pending: reconcile.pending,
    facts: reconcile.facts,
    live: liveStatus,
  };

  return { reconcile, payload, humanReport: formatLifecycleReport(phase, reconcile, payload) };
}

export function formatLifecycleReport(phase, result, payload) {
  const banner =
    phase === 'start'
      ? 'WEBXXL CONTINUITY START (CONTINUITY-04)'
      : phase === 'checkpoint'
        ? 'WEBXXL CONTINUITY CHECKPOINT (CONTINUITY-04)'
        : 'WEBXXL CONTINUITY CLOSEOUT (CONTINUITY-04)';
  const lines = [
    banner,
    `Phase: ${phase}`,
    `Status: ${result.status}`,
    `Reason code: ${payload.reasonCode}`,
    `Evidence as-of: ${payload.evidenceAsOf}`,
    '',
    formatCloseoutReport(result).split('\n').slice(1).join('\n'),
    '',
    'Live derived main (read-only):',
    `  ${payload.live.live_main_sha ?? 'UNVERIFIED'}`,
    'Last reconciled main (checkpoint field 2):',
    `  ${payload.live.documented_main_sha ?? 'UNKNOWN'}`,
  ];
  if (payload.live.latest_merged_prs?.length) {
    lines.push('', 'Recent merged PRs (GitHub):');
    for (const pr of payload.live.latest_merged_prs.slice(0, 5)) {
      lines.push(`  #${pr.number} @ ${(pr.mergeSha ?? 'UNKNOWN').slice(0, 12)}… — ${pr.title}`);
    }
  }
  lines.push('', `Bot docs-sync PR writer: ${payload.live.bot_docs_sync_pr.enabled ? 'enabled' : 'disabled'} (${payload.live.bot_docs_sync_pr.reason})`);
  return lines.join('\n');
}

export function lifecycleExitCode(status) {
  if (status === 'CONFLICT') return 1;
  if (status === 'PENDING_REPOSITORY_SYNC') return 2;
  return 0;
}
