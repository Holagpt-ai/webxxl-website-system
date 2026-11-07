import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyDivergence } from '../../scripts/check-branch-divergence.mjs';
import { collectStaleStatusWarnings, loadOperationalStatus } from '../../scripts/check-stale-operational-status.mjs';
import { assessEvidence } from '../../scripts/check-deployment-evidence.mjs';
import { buildHandoffDraft } from '../../scripts/draft-session-handoff.mjs';
import { validateAdrs } from '../../scripts/validate-adr.mjs';
import { validateContinuity, validateSessionHandoff } from '../../scripts/validate-continuity.mjs';
import { validateGenerated } from '../../scripts/validate-generated.mjs';
import { validateNavHrefs } from '../../scripts/validate-routes.mjs';
import { validateRoutes } from '../../scripts/validate-routes.mjs';
import { validateSeo, validateStaticPaths } from '../../scripts/validate-seo.mjs';
import {
  firstSha,
  looksLikeOpenPrClaim,
  parseSixFieldCheckpoint,
  shasPrefixMatch,
} from '../../scripts/continuity-parse.mjs';
import {
  evaluateCheckpointMainLineage,
  gitIsAncestor,
  reconcileContinuity,
} from '../../scripts/continuity-reconcile.mjs';
import {
  buildPostMergePendingSyncArtifact,
  dedupePendingItems,
  postMergeCheckpointPendingItem,
} from '../../scripts/post-merge-pending-sync.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function gitCmd(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
}

function writeCheckpointDocs(root, mainSha) {
  const table = [
    `**Evidence review:** 2026-11-07 · **\`main\`:** \`${mainSha}\``,
    '### Canonical checkpoint (six-field)',
    '| # | Field | Value |',
    '|---|---|---|',
    '| 1 | Last verified checkpoint | test |',
    `| 2 | GitHub SHA, branch, active PR | **\`${mainSha}\`** on \`main\` |`,
    '| 3 | Production deployment | UNVERIFIED |',
    '| 4 | Last updated | 2026-11-07 |',
    '| 5 | Next task / responsible platform | wait |',
    '| 6 | Open blocker / gate IDs | none |',
    '| PR #99 fixture | MERGED | abc |',
  ].join('\n');
  const handoff = [
    `**\`main\`:** \`${mainSha}\``,
    '## Canonical checkpoint (six-field)',
    table.split('### Canonical checkpoint (six-field)')[1],
    '## PENDING REPOSITORY SYNC',
    '(none)',
  ].join('\n');
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'PROJECT_MEMORY.md'), table);
  writeFileSync(join(root, 'docs', 'SESSION_HANDOFF.md'), handoff);
  writeFileSync(join(root, 'docs', 'ISSUE_REGISTER.md'), '| id | status | notes | evidence | action |\n');
  writeFileSync(join(root, 'docs', 'CHANGELOG.md'), '# changelog\n');
  writeFileSync(join(root, 'docs', 'CHATGPT_PROJECT_INSTRUCTIONS.md'), '# chatgpt\n');
  writeFileSync(join(root, 'docs', 'DATA_AND_SERVICES.md'), '# data\n');
  mkdirSync(join(root, 'docs', 'platform', 'docs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'platform', 'docs', '02-CURRENT-STATE.md'), '# state\n');
  writeFileSync(join(root, 'docs', 'platform', 'docs', '13-IMPLEMENTATION-ROADMAP.md'), '# roadmap\n');
  if (!existsSync(join(root, 'docs', 'adr', 'INDEX.md'))) {
    cpSync(join(ROOT, 'docs', 'adr'), join(root, 'docs', 'adr'), { recursive: true });
    const decisions = join(ROOT, 'docs', 'platform', 'docs', '15-DECISIONS-CHANGELOG.md');
    if (existsSync(decisions)) {
      mkdirSync(join(root, 'docs', 'platform', 'docs'), { recursive: true });
      writeFileSync(join(root, 'docs', 'platform', 'docs', '15-DECISIONS-CHANGELOG.md'), readFileSync(decisions));
    }
  }
}

function initFixtureRepo(root) {
  gitCmd(root, 'init', '-b', 'main');
  gitCmd(root, 'config', 'user.email', 'continuity@test.local');
  gitCmd(root, 'config', 'user.name', 'continuity-test');
  writeFileSync(join(root, 'README.md'), 'application v1\n');
  gitCmd(root, 'add', 'README.md');
  gitCmd(root, 'commit', '-m', 'application base');
  return gitCmd(root, 'rev-parse', 'HEAD');
}

test('continuity documents and ADR proposals validate', () => {
  assert.deepEqual(validateContinuity(ROOT).errors, []);
  assert.deepEqual(validateRoutes(ROOT).errors, []);
  assert.deepEqual(validateSeo(ROOT).errors, []);
  assert.deepEqual(validateGenerated(ROOT).errors, []);
});

test('a nav href without a page is reported', () => {
  assert.match(validateNavHrefs(['/missing'], ['/']).join('\n'), /\/missing/);
});

test('private sitemap paths are rejected', () => {
  assert.match(validateStaticPaths(['/login'], ['/login']).join('\n'), /private path/);
});

test('branch divergence is advisory metadata, not an exception', () => {
  assert.equal(classifyDivergence(2, 1).warning, true);
  assert.equal(classifyDivergence(0, 4).warning, false);
});

test('deployment evidence cannot claim a live verification without flags', () => {
  const result = assessEvidence({
    environment: 'Production',
    service: 'webxxl-website-system',
    released_at_utc: '2026-10-21T17:41:12Z',
    git_sha: 'c0a21db93d730c838fc58d9b862ed547927bd72f',
    deployment_id: '1',
    state: 'success',
    evidence_url: 'https://example.test/evidence',
    migration_ids_applied: 'UNVERIFIED',
    flags: 'UNVERIFIED',
    provider_scope: 'UNVERIFIED',
    result: 'VERIFIED_LIVE',
  });
  assert.match(result.errors.join('\n'), /VERIFIED_LIVE/);
});

test('handoff draft keeps production claims out of the git head', () => {
  const draft = buildHandoffDraft({ branch: 'feature/example', headSha: 'abc', mainSha: 'def' });
  assert.match(draft, /Do NOT touch:/);
  assert.match(draft, /do not copy the head SHA into production/);
});

test('session handoff accepts a future batch label without hardcoding Batch 15', () => {
  const handoff = [
    '## This session',
    'Branch: feature/example',
    'Merged: NO',
    'Migration applied: NO',
    '## Next assignment',
    'Batch 16 — Example follow-on work. Cursor owns backend; v0.app owns UI after APIs land.',
    '## Handoff template',
    'Do NOT touch:',
    'Next exact assignment / owning tool:',
  ].join('\n');
  assert.deepEqual(validateSessionHandoff(handoff), []);
});

test('session handoff rejects a missing next-assignment block', () => {
  const handoff = 'Branch: x\nMerged: NO\nMigration applied: NO\nDo NOT touch:\n';
  assert.match(validateSessionHandoff(handoff).join('\n'), /Next assignment/);
});

test('continuity delegates ADR approval rules to validate-adr', () => {
  assert.deepEqual(validateContinuity(ROOT).errors, []);
  assert.equal(validateAdrs(ROOT).checked, 3);
});

const MERGED_MEMORY = [
  '| Item | State | Evidence |',
  '| PR #50 continuity / ADR | MERGED | 622b352592f2cdcb359034e1c6462cb62130b1d1 |',
  '| Batch 15 ingestion pipeline (PR #51) | MERGED | f315e897218a48bfac44a0d50724c91d32b6c9c9 |',
  '| Batch 16 dashboards | PLANNED | direction only |',
].join('\n');

test('stale open wording is warned only for the latest merged batch or a recorded merged PR', () => {
  const warnings = collectStaleStatusWarnings({
    projectMemory: MERGED_MEMORY,
    handoff: '## This session — Batch 15\nMerged: **NO**\n## Handoff template\nNOT MERGED\n',
    documents: [
      { name: 'docs/CHANGELOG.md', text: '| 2026-10-25 | Batch 15 | IN PR. No activation claim |' },
      { name: 'docs/platform/docs/02-CURRENT-STATE.md', text: '**COMMS-06A (in PR #38):** historical note' },
      { name: 'docs/SESSION_HANDOFF.md', text: 'main SHA f315e897218a48bfac44a0d50724c91d32b6c9c9 differs from an older note' },
    ],
  });
  const text = warnings.join('\n');
  assert.match(text, /Batch 15/);
  assert.match(text, /docs\/CHANGELOG.md:1/);
  assert.equal(warnings.some((warning) => warning.includes('PR #38')), false);
  assert.equal(warnings.some((warning) => warning.includes('differs from an older note')), false);
});

test('a merged handoff and a different documentation SHA stay quiet', () => {
  const warnings = collectStaleStatusWarnings({
    projectMemory: MERGED_MEMORY,
    handoff: [
      '## Latest completed batch',
      'Batch 15 is MERGED as PR #51',
      '## Next assignment',
      'Batch 16 awaits file ownership. Cursor owns backend. v0.app owns UI.',
      '## Handoff template',
      'Next exact assignment / owning tool: Cursor',
    ].join('\n'),
    documents: [
      { name: 'docs/CHANGELOG.md', text: '| Batch 15 | MERGED | older SHA c0a21db remains a separate deploy record |' },
    ],
  });
  assert.deepEqual(warnings, []);
});

test('recorded merged PR numbers still marked open are warned without reading HEAD', () => {
  const warnings = collectStaleStatusWarnings({
    projectMemory: MERGED_MEMORY,
    handoff: '## Baseline\nPR #50 is on main\n',
    documents: [{ name: 'docs/ISSUE_REGISTER.md', text: '| CONT-001 | IN PR | closed by PR #50 |' }],
  });
  assert.match(warnings.join('\n'), /PR #50/);
});

test('the current operational records do not describe the latest merged batch as open', () => {
  assert.deepEqual(collectStaleStatusWarnings(loadOperationalStatus(ROOT)), []);
});

test('six-field checkpoint parsing reads table cells', () => {
  const md = [
    '### Canonical checkpoint (six-field)',
    '| # | Field | Value |',
    '|---|---|---|',
    '| 1 | Last verified checkpoint | main abcdef1 |',
    '| 2 | GitHub SHA, branch, active PR | `abcdef1234567890` on main |',
  ].join('\n');
  const fields = parseSixFieldCheckpoint(md);
  assert.equal(fields['1'], 'main abcdef1');
  assert.match(fields['2'], /abcdef1234567890/);
});

test('open PR claim heuristics detect owner-review wording', () => {
  assert.equal(looksLikeOpenPrClaim('Owner review of PR #50'), true);
  assert.equal(looksLikeOpenPrClaim('PR #106 MERGED on main'), false);
});

test('sha prefix match tolerates short and full hashes', () => {
  assert.equal(shasPrefixMatch('e37f0a023dd2', 'e37f0a023dd289dc3a9b4e7484f6a1dd34b24276'), true);
});

test('reconcile reports checkpoint mismatch between memory and handoff', () => {
  const root = mkdtempSync(join(tmpdir(), 'webxxl-reconcile-'));
  try {
    mkdirSync(join(root, 'docs'));
    mkdirSync(join(root, 'docs', 'adr'));
    mkdirSync(join(root, 'docs', 'platform', 'docs'), { recursive: true });
    const table = (field2) =>
      [
        '**`main`:** `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`',
        '### Canonical checkpoint (six-field)',
        '| # | Field | Value |',
        '|---|---|---|',
        '| 1 | Last verified checkpoint | test |',
        `| 2 | GitHub SHA, branch, active PR | ${field2} |`,
        '| 3 | Production deployment | UNVERIFIED |',
        '| 4 | Last updated | 2026-11-07 |',
        '| 5 | Next task / responsible platform | wait |',
        '| 6 | Open blocker / gate IDs | none |',
        '| PR #99 test | MERGED | abc |',
      ].join('\n');
    writeFileSync(join(root, 'docs', 'PROJECT_MEMORY.md'), table('field A'));
    writeFileSync(join(root, 'docs', 'SESSION_HANDOFF.md'), table('field B'));
    writeFileSync(join(root, 'docs', 'ISSUE_REGISTER.md'), '| x | y | z | w | notes |\n');
    writeFileSync(join(root, 'docs', 'CHANGELOG.md'), '# changelog\n');
    writeFileSync(join(root, 'docs', 'adr', 'INDEX.md'), '# ADR index\n');
    const result = reconcileContinuity(root, { eventName: 'pull_request', strictExternal: false, skipGitFetch: true });
    assert.equal(result.status, 'CONFLICT');
    assert.ok(result.conflicts.some((c) => c.includes('field 2')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('reconcile does not require doc SHA to match HEAD on a feature branch', () => {
  const result = reconcileContinuity(ROOT, { eventName: 'pull_request', isMainPush: false, strictExternal: false });
  assert.notEqual(result.status, 'CONFLICT', result.conflicts.join('; '));
});

test('the current repository reconciles without deterministic conflicts', () => {
  const result = reconcileContinuity(ROOT, { eventName: 'pull_request', isMainPush: false, strictExternal: false });
  assert.equal(result.conflicts.length, 0, result.conflicts.join('\n'));
});

test('dedupePendingItems collapses duplicate post-merge rows', () => {
  const row = postMergeCheckpointPendingItem('aaaa', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  const merged = dedupePendingItems([row, row, `- manual`, `- manual`]);
  assert.equal(merged.length, 2);
});

test('pull_request reconcile ignores GITHUB_SHA merge ref', () => {
  const previous = process.env.GITHUB_SHA;
  process.env.GITHUB_SHA = 'ffffffffffffffffffffffffffffffffffffffff';
  try {
    const result = reconcileContinuity(ROOT, {
      eventName: 'pull_request',
      isMainPush: false,
      strictExternal: false,
    });
    assert.notEqual(result.facts.referenceMain, 'ffffffffffffffffffffffffffffffffffffffff');
    assert.equal(result.facts.referenceMainSource, 'origin/main (not PR merge ref)');
    if (result.facts.originMain) assert.equal(result.facts.referenceMain, result.facts.originMain);
  } finally {
    if (previous === undefined) delete process.env.GITHUB_SHA;
    else process.env.GITHUB_SHA = previous;
  }
});

test('push:main after feature merge: stale checkpoint is PENDING not CONFLICT', () => {
  const root = mkdtempSync(join(tmpdir(), 'webxxl-merge-lag-'));
  try {
    const baseSha = initFixtureRepo(root);
    writeCheckpointDocs(root, baseSha);
    gitCmd(root, 'add', 'docs');
    gitCmd(root, 'commit', '-m', 'document checkpoint at application base');
    writeFileSync(join(root, 'README.md'), 'application v2\n');
    gitCmd(root, 'add', 'README.md');
    gitCmd(root, 'commit', '-m', 'merge batch code without bumping checkpoint');
    const mainTip = gitCmd(root, 'rev-parse', 'HEAD');
    assert.equal(evaluateCheckpointMainLineage(root, baseSha, mainTip), 'checkpoint_lags_main');
    const result = reconcileContinuity(root, {
      isMainPush: true,
      ciGitHubSha: mainTip,
      eventName: 'push',
      skipGitFetch: true,
    });
    assert.equal(result.conflicts.length, 0, result.conflicts.join('\n'));
    assert.equal(result.status, 'PENDING_REPOSITORY_SYNC');
    assert.ok(result.pending.some((p) => /POST-MERGE-CHECKPOINT/i.test(p)));
    const artifact = buildPostMergePendingSyncArtifact(result);
    assert.equal(artifact.detection_only, true);
    assert.equal(artifact.tracking_issue, 109);
    assert.ok(artifact.post_merge_items.length >= 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('push:main exact checkpoint match yields SYNCHRONIZED', () => {
  const memory = readFileSync(join(ROOT, 'docs', 'PROJECT_MEMORY.md'), 'utf8');
  const documented = firstSha(parseSixFieldCheckpoint(memory)['2'] ?? '');
  const result = reconcileContinuity(ROOT, {
    isMainPush: true,
    ciGitHubSha: documented,
    referenceMain: documented,
    eventName: 'push',
    skipGitFetch: true,
  });
  assert.equal(result.conflicts.length, 0, result.conflicts.join('\n'));
  assert.equal(result.status, 'SYNCHRONIZED');
  assert.equal(result.pending.length, 0);
});

test('evaluateCheckpointMainLineage synced when SHAs match', () => {
  const root = mkdtempSync(join(tmpdir(), 'webxxl-lineage-'));
  try {
    const sha = initFixtureRepo(root);
    assert.equal(evaluateCheckpointMainLineage(root, sha, sha), 'synced');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('missing evidence stays unverified', () => {
  assert.match(assessEvidence(null).summary, /UNVERIFIED/);
  const root = mkdtempSync(join(tmpdir(), 'webxxl-empty-'));
  try {
    mkdirSync(join(root, 'unused'));
    writeFileSync(join(root, 'unused', 'note.txt'), 'unused');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
