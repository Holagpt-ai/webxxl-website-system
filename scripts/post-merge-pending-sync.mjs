/**
 * Single deduplicated post-merge pending-sync model (CONTINUITY-03).
 * Detection and CI artifacts only — no repository writes, no auto issue creation.
 * Owner-approved tracking: Issue #109 (execution roadmap; CONTINUITY-03 closed in PR #108).
 */
export const POST_MERGE_PENDING_SYNC_ISSUE = 109;

export function normalizePendingKey(text) {
  return (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Deduplicate pending lines by normalized text (manual handoff + auto-detected). */
export function dedupePendingItems(items) {
  const seen = new Set();
  const out = [];
  for (const item of items ?? []) {
    const key = normalizePendingKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Canonical auto-detected row when GitHub main advanced past the documented checkpoint SHA.
 */
export function postMergeCheckpointPendingItem(documentedMain, referenceMain, issueNumber = POST_MERGE_PENDING_SYNC_ISSUE) {
  const docShort = (documentedMain ?? 'UNKNOWN').slice(0, 12);
  const refShort = (referenceMain ?? 'UNKNOWN').slice(0, 12);
  return `POST-MERGE-CHECKPOINT | GitHub main is ${refShort}… but checkpoint field 2 still names ${docShort}…. Update \`docs/PROJECT_MEMORY.md\` and \`docs/SESSION_HANDOFF.md\` (six-field checkpoint). Track on Issue #${issueNumber}. Detection only — CI does not open or edit issues.`;
}

export function buildPostMergePendingSyncArtifact(result) {
  const pending = dedupePendingItems(result?.pending ?? []);
  const postMerge = pending.filter((p) => /POST-MERGE-CHECKPOINT/i.test(p));
  return {
    schema: 'webxxl-post-merge-pending-sync-v1',
    status: result?.status ?? 'UNKNOWN',
    tracking_issue: POST_MERGE_PENDING_SYNC_ISSUE,
    detection_only: true,
    issue_writer: `none (owner updates Issue #${POST_MERGE_PENDING_SYNC_ISSUE} or next docs PR)`,
    post_merge_items: postMerge,
    all_pending_items: pending,
    conflicts: result?.conflicts ?? [],
    facts: {
      documented_main: result?.facts?.documentedMain ?? null,
      reference_main: result?.facts?.referenceMain ?? null,
      deployment_evidence: result?.facts?.deploymentEvidence ?? 'UNVERIFIED',
    },
  };
}
