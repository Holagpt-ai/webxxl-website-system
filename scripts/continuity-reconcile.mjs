/**
 * Evidence-aware continuity reconciliation (CONTINUITY-04).
 * Read-only. Does not mutate git, production, or remote services except optional GitHub API reads.
 */
import { validateOperationalAnchors } from './validate-operational-anchors.mjs';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateAdrs } from './validate-adr.mjs';
import { collectStaleStatusWarnings, loadOperationalStatus } from './check-stale-operational-status.mjs';
import {
  firstSha,
  looksLikeOpenPrClaim,
  openPrNumbersInText,
  parsePendingRepositorySync,
  parseSixFieldCheckpoint,
  prNumbers,
  readCheckpointPair,
  shasPrefixMatch,
} from './continuity-parse.mjs';
import { dedupePendingItems, postMergeCheckpointPendingItem } from './post-merge-pending-sync.mjs';

export const CLOSEOUT_STATUSES = ['SYNCHRONIZED', 'PENDING_REPOSITORY_SYNC', 'CONFLICT'];

function gitSha(root, ref) {
  try {
    return execFileSync('git', ['rev-parse', ref], { cwd: root, encoding: 'utf8' }).trim().toLowerCase();
  } catch {
    return null;
  }
}

function gitFetchMain(root) {
  try {
    execFileSync('git', ['fetch', 'origin', 'main'], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  } catch {
    /* offline or no remote */
  }
}

export function gitIsAncestor(root, ancestorSha, descendantSha) {
  if (!ancestorSha || !descendantSha) return false;
  if (shasPrefixMatch(ancestorSha, descendantSha)) return true;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestorSha, descendantSha], {
      cwd: root,
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * @returns {'synced' | 'checkpoint_lags_main' | 'impossible_ahead' | 'divergent'}
 */
export function evaluateCheckpointMainLineage(root, documentedMain, referenceMain) {
  if (!documentedMain || !referenceMain) return 'synced';
  if (shasPrefixMatch(documentedMain, referenceMain)) return 'synced';
  if (gitIsAncestor(root, documentedMain, referenceMain)) return 'checkpoint_lags_main';
  if (gitIsAncestor(root, referenceMain, documentedMain)) return 'impossible_ahead';
  return 'divergent';
}

function ghJson(args) {
  try {
    const out = execFileSync('gh', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return JSON.parse(out);
  } catch {
    return null;
  }
}

function githubEvidence(sha) {
  if (!sha) return null;
  const status = ghJson([
    'api',
    `repos/Holagpt-ai/webxxl-website-system/commits/${sha}/status`,
    '--jq',
    '{state, vercel: ([.statuses[] | select(.context=="Vercel") | {state, description, target_url}][0])}',
  ]);
  return status;
}

export function mergedPrCheck(prNumber) {
  const pr = ghJson([
    'pr',
    'view',
    String(prNumber),
    '--repo',
    'Holagpt-ai/webxxl-website-system',
    '--json',
    'state,mergedAt,mergeCommit',
  ]);
  if (!pr) return { available: false, merged: false };
  return {
    available: true,
    merged: pr.state === 'MERGED',
    mergedAt: pr.mergedAt,
    mergeSha: pr.mergeCommit?.oid?.toLowerCase() ?? null,
  };
}

/**
 * @returns {'post_merge_sync' | 'contradiction'}
 */
export function classifyStaleOpenMergedPr(root, documentedMain, referenceMain, mergeSha, isMainPush) {
  if (!documentedMain || !referenceMain || !mergeSha) return 'contradiction';
  if (shasPrefixMatch(documentedMain, referenceMain)) return 'contradiction';
  if (gitIsAncestor(root, mergeSha, documentedMain)) return 'contradiction';
  const lags = evaluateCheckpointMainLineage(root, documentedMain, referenceMain) === 'checkpoint_lags_main';
  const mergeOnRef =
    shasPrefixMatch(mergeSha, referenceMain) ||
    (gitIsAncestor(root, mergeSha, referenceMain) && gitIsAncestor(root, documentedMain, mergeSha));
  if (isMainPush === true && lags && mergeOnRef) return 'post_merge_sync';
  return 'contradiction';
}

function checkpointFieldsMatch(memoryFields, handoffFields) {
  const errors = [];
  for (const key of ['1', '2', '3', '4', '5', '6']) {
    const a = (memoryFields[key] ?? '').replace(/\s+/g, ' ').trim();
    const b = (handoffFields[key] ?? '').replace(/\s+/g, ' ').trim();
    if (a !== b) errors.push(`canonical checkpoint field ${key} differs between PROJECT_MEMORY and SESSION_HANDOFF`);
  }
  return errors;
}

function resolveReferenceMain(root, options, originMain, headSha) {
  if (options.referenceMain !== undefined) return options.referenceMain;
  if (options.isMainPush === true && options.ciGitHubSha) {
    return options.ciGitHubSha.toLowerCase();
  }
  if (options.eventName === 'pull_request') {
    return originMain;
  }
  return originMain ?? headSha;
}

/**
 * @param {string} root
 * @param {{
 *   eventName?: string,
 *   isMainPush?: boolean,
 *   ciGitHubSha?: string | null,
 *   referenceMain?: string | null,
 *   strictExternal?: boolean,
 *   lifecyclePhase?: 'start' | 'checkpoint' | 'close' | 'ci',
 *   skipGitFetch?: boolean,
 *   mergedPrCheckFn?: (pr: string) => ReturnType<typeof mergedPrCheck>,
 * }} options
 */
export function reconcileContinuity(root, options = {}) {
  const checkMergedPr = options.mergedPrCheckFn ?? mergedPrCheck;
  const conflicts = [];
  const pending = [];

  const { projectMemory, sessionHandoff, memoryFields, handoffFields } = readCheckpointPair(root);

  if (!Object.keys(memoryFields).length) conflicts.push('PROJECT_MEMORY.md missing canonical six-field checkpoint');
  if (!Object.keys(handoffFields).length) conflicts.push('SESSION_HANDOFF.md missing canonical six-field checkpoint');
  conflicts.push(...checkpointFieldsMatch(memoryFields, handoffFields));

  const documentedMain = firstSha(memoryFields['2'] ?? '');
  const headerMain = firstSha(
    (projectMemory.match(/^\*\*`main`:\*\*\s*`([^`]+)`/m) ?? [])[1] ??
      (projectMemory.match(/\*\*`main`:\*\*\s*`([^`]+)`/m) ?? [])[1],
  );

  if (headerMain && documentedMain && !shasPrefixMatch(headerMain, documentedMain)) {
    conflicts.push('PROJECT_MEMORY header main SHA disagrees with checkpoint field 2');
  }

  const handoffHeaderMain = firstSha(sessionHandoff.match(/\*\*`main`:\*\*\s*`([^`]+)`/m)?.[1] ?? '');
  if (handoffHeaderMain && documentedMain && !shasPrefixMatch(handoffHeaderMain, documentedMain)) {
    conflicts.push('SESSION_HANDOFF header main SHA disagrees with checkpoint field 2');
  }

  if (!options.skipGitFetch) gitFetchMain(root);
  const originMain = gitSha(root, 'origin/main');
  const headSha = gitSha(root, 'HEAD');
  const referenceMain = resolveReferenceMain(root, options, originMain, headSha);

  if (options.isMainPush === true && referenceMain && documentedMain) {
    const lineage = evaluateCheckpointMainLineage(root, documentedMain, referenceMain);
    if (lineage === 'checkpoint_lags_main') {
      pending.push(postMergeCheckpointPendingItem(documentedMain, referenceMain));
    } else if (lineage === 'impossible_ahead') {
      conflicts.push(
        `checkpoint main SHA (${documentedMain.slice(0, 12)}…) is ahead of current GitHub main (${referenceMain.slice(0, 12)}…)`,
      );
    } else if (lineage === 'divergent') {
      conflicts.push(
        `checkpoint main SHA (${documentedMain.slice(0, 12)}…) is not an ancestor of current GitHub main (${referenceMain.slice(0, 12)}…)`,
      );
    }
  } else if (referenceMain && documentedMain && !shasPrefixMatch(documentedMain, referenceMain)) {
    const lineage = evaluateCheckpointMainLineage(root, documentedMain, referenceMain);
    if (lineage === 'checkpoint_lags_main') {
      pending.push(postMergeCheckpointPendingItem(documentedMain, referenceMain));
    }
  }

  const verifyOpenPrs =
    options.strictExternal || options.lifecyclePhase === 'close' || options.lifecyclePhase === 'start';
  const openPrs = new Set();
  for (const value of Object.values(memoryFields)) {
    for (const pr of openPrNumbersInText(value ?? '')) openPrs.add(pr);
  }
  for (const pr of openPrs) {
    const check = checkMergedPr(pr);
    if (check.available && check.merged) {
      const kind = classifyStaleOpenMergedPr(
        root,
        documentedMain,
        referenceMain,
        check.mergeSha,
        options.isMainPush === true,
      );
      if (kind === 'post_merge_sync') {
        pending.push(
          `POST-MERGE-PR-#${pr} | PR #${pr} merged on current main; refresh checkpoint open wording (not a stale contradiction)`,
        );
      } else {
        conflicts.push(`checkpoint still describes PR #${pr} as open but GitHub reports MERGED`);
      }
    } else if (!check.available && verifyOpenPrs) {
      pending.push(`Could not verify PR #${pr} merge state (GitHub API unavailable)`);
    }
  }

  const issueRegister = existsSync(join(root, 'docs', 'ISSUE_REGISTER.md'))
    ? readFileSync(join(root, 'docs', 'ISSUE_REGISTER.md'), 'utf8')
    : '';
  for (const line of issueRegister.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    if (!/\|\s*IN PR\s*\|/i.test(line)) continue;
    const nums = prNumbers(line);
    if (!nums.length) continue;
    const check = checkMergedPr(nums[0]);
    if (check.available && check.merged) {
      conflicts.push(`ISSUE_REGISTER row still IN PR but PR #${nums[0]} is MERGED on GitHub`);
    }
  }
  if (/\|\s*CRM-PAGE-105\s*\|\s*IN PR\s*\|/i.test(issueRegister)) {
    const pr106 = checkMergedPr('106');
    if (pr106.available && pr106.merged) {
      conflicts.push('ISSUE_REGISTER CRM-PAGE-105 is IN PR but PR #106 is MERGED on GitHub');
    }
  }

  const anchorPhase = options.strictExternal || options.lifecyclePhase === 'close';
  if (anchorPhase) {
    const anchors = validateOperationalAnchors(root);
    conflicts.push(...anchors.errors);
    for (const warning of anchors.warnings) {
      if (options.strictExternal) conflicts.push(`operational anchor: ${warning}`);
    }
  }

  const operational = loadOperationalStatus(root);
  const staleWarnings = collectStaleStatusWarnings(operational);
  for (const warning of staleWarnings) {
    conflicts.push(`stale operational status: ${warning}`);
  }

  const adr = validateAdrs(root);
  conflicts.push(...adr.errors);

  const pendingSync = parsePendingRepositorySync(sessionHandoff);
  for (const item of pendingSync.items) pending.push(`PENDING REPOSITORY SYNC: ${item}`);

  const dedupedPending = dedupePendingItems(pending);

  const evidenceSha = documentedMain ?? referenceMain;
  const vercelEvidence = evidenceSha ? githubEvidence(evidenceSha) : null;
  let deploymentEvidence = 'UNVERIFIED';
  if (vercelEvidence?.vercel) deploymentEvidence = 'AVAILABLE';
  else if (options.strictExternal && evidenceSha) {
    dedupedPending.push(
      `Vercel/GitHub deployment status for documented main SHA was not available (UNVERIFIED; not a blocking failure)`,
    );
  }

  let status = 'SYNCHRONIZED';
  if (conflicts.length) status = 'CONFLICT';
  else if (dedupedPending.length) status = 'PENDING_REPOSITORY_SYNC';
  const materialStaleOpen = conflicts.some((c) => /still describes PR #\d+ as open/i.test(c));
  if (materialStaleOpen && status === 'SYNCHRONIZED') status = 'CONFLICT';

  return {
    status,
    conflicts,
    pending: dedupePendingItems(dedupedPending),
    facts: {
      documentedMain,
      originMain,
      headSha,
      referenceMain,
      referenceMainSource:
        options.isMainPush === true && options.ciGitHubSha ? 'push:main GITHUB_SHA' : 'origin/main (not PR merge ref)',
      memoryFields,
      handoffFields,
      vercelEvidence,
      deploymentEvidence,
    },
  };
}

export function formatCloseoutReport(result) {
  const { status, conflicts, pending, facts } = result;
  const lines = [
    'WEBXXL CONTINUITY CLOSEOUT (CONTINUITY-04)',
    `Status: ${status}`,
    '',
    '1. GitHub',
    `   Documented main (checkpoint field 2): ${facts.documentedMain ?? 'UNKNOWN'}`,
    `   origin/main: ${facts.originMain ?? 'UNVERIFIED'}`,
    `   HEAD: ${facts.headSha ?? 'UNVERIFIED'}`,
    `   Reference main (${facts.referenceMainSource}): ${facts.referenceMain ?? 'UNVERIFIED'}`,
    '',
    '2. Production / Preview deployment (SHA evidence only)',
    facts.deploymentEvidence === 'AVAILABLE' && facts.vercelEvidence?.vercel
      ? `   Vercel (documented SHA): ${facts.vercelEvidence.vercel.state} — ${facts.vercelEvidence.vercel.description ?? ''} ${facts.vercelEvidence.vercel.target_url ?? ''}`
      : `   Vercel (documented SHA): ${facts.deploymentEvidence} (SYNCHRONIZED does not imply live deployment proof)`,
    '',
    '3. Migrations',
    `   ${facts.memoryFields['6'] ?? '(see checkpoint field 6)'}`,
    '',
    '4. Flags / providers / activation',
    `   ${facts.memoryFields['6'] ?? '(see checkpoint field 6)'}`,
    '',
    '5. Checkpoint snapshot',
    ...['1', '2', '3', '4', '5', '6'].map((k) => `   [${k}] ${facts.memoryFields[k] ?? ''}`),
    '',
    '6. Next assignment',
    `   ${facts.memoryFields['5'] ?? ''}`,
    '',
    'Prohibited without owner authorization: production migrate, flags, providers, sends, DNS cutover, merge without review.',
  ];
  if (conflicts.length) {
    lines.push('', 'CONFLICTS:', ...conflicts.map((c) => ` - ${c}`));
  }
  if (pending.length) {
    lines.push('', 'PENDING:', ...pending.map((p) => ` - ${p}`));
  }
  return lines.join('\n');
}
