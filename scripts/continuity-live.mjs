/**
 * Read-only live GitHub facts for CONTINUITY-04 (no repository writes).
 */
import { execFileSync } from 'node:child_process';

const REPO = 'Holagpt-ai/webxxl-website-system';

function ghJson(args) {
  try {
    const out = execFileSync('gh', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return JSON.parse(out);
  } catch {
    return null;
  }
}

export function gitSha(root, ref) {
  try {
    return execFileSync('git', ['rev-parse', ref], { cwd: root, encoding: 'utf8' }).trim().toLowerCase();
  } catch {
    return null;
  }
}

export function fetchLiveMainSha(root) {
  try {
    execFileSync('git', ['fetch', 'origin', 'main'], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  } catch {
    /* offline */
  }
  return gitSha(root, 'origin/main') ?? gitSha(root, 'main');
}

/**
 * @returns {{ available: boolean, prs: Array<{ number: number, mergeSha: string | null, title: string }> }}
 */
export function fetchRecentlyMergedPullRequests(limit = 8) {
  const list = ghJson([
    'pr',
    'list',
    '--repo',
    REPO,
    '--state',
    'merged',
    '--limit',
    String(limit),
    '--json',
    'number,title,mergeCommit',
  ]);
  if (!list) return { available: false, prs: [] };
  return {
    available: true,
    prs: list.map((pr) => ({
      number: pr.number,
      title: pr.title ?? '',
      mergeSha: pr.mergeCommit?.oid?.toLowerCase() ?? null,
    })),
  };
}

export function buildContinuityLiveStatus(result, liveMain, mergedPrs) {
  const evidenceAsOf = new Date().toISOString();
  const documented = result?.facts?.documentedMain ?? null;
  const reference = result?.facts?.referenceMain ?? liveMain ?? null;
  return {
    schema: 'webxxl-continuity-live-status-v1',
    evidence_as_of: evidenceAsOf,
    live_main_sha: liveMain ?? reference,
    documented_main_sha: documented,
    last_reconciled_main_sha: documented,
    reconcile_status: result?.status ?? 'UNKNOWN',
    reason_code: result?.reasonCode ?? 'UNKNOWN',
    latest_merged_prs: mergedPrs?.prs ?? [],
    github_api_available: mergedPrs?.available ?? false,
    bot_docs_sync_pr: {
      enabled: false,
      mode: 'detection_only',
      reason: 'Owner approval required before any automated docs-sync branch or PR writer',
    },
    conflicts: result?.conflicts ?? [],
    pending: result?.pending ?? [],
    note: 'Green CI does not imply documentation was reconciled to live main; compare live_main_sha with last_reconciled_main_sha.',
  };
}
