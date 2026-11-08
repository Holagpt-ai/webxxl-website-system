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
  prNumbers,
  shasPrefixMatch,
} from '../../scripts/continuity-parse.mjs';
import {
  classifyStaleOpenMergedPr,
  evaluateCheckpointMainLineage,
  gitIsAncestor,
  reconcileContinuity,
  resolveMergedOpenPrDrift,
} from '../../scripts/continuity-reconcile.mjs';
import { openPrNumbersInText } from '../../scripts/continuity-parse.mjs';
import { parseContinuityCliArgs } from '../../scripts/continuity-cli-args.mjs';
import { applySnapshotFromFile, proposeCheckpointSnapshot } from '../../scripts/continuity-docs-snapshot.mjs';
import { deriveReasonCode, runContinuityLifecycle } from '../../scripts/continuity-lifecycle.mjs';
import { validateOperationalAnchors } from '../../scripts/validate-operational-anchors.mjs';
import { buildContinuityLiveStatus } from '../../scripts/continuity-live.mjs';
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

test('handoff template fenced examples are excluded from stale-status line scans', () => {
  const warnings = collectStaleStatusWarnings({
    projectMemory: '| CONTINUITY-04 | MERGED | [PR #122](https://github.com/Holagpt-ai/webxxl-website-system/pull/122) `c488b10a6143a7b358e0f88158ac09ea91289815` |',
    handoff: '## Handoff template\n(skipped by section title)\n',
    documents: [
      {
        name: 'docs/SESSION_HANDOFF.md',
        text: [
          '## Canonical checkpoint (six-field)',
          '| 2 | GitHub SHA | merged [PR **#122**](https://github.com/Holagpt-ai/webxxl-website-system/pull/122) on `main` |',
          '## Handoff template',
          '```',
          'Branch / PR: feature/issue-121-continuity-04 / PR #122 (owner review, not merged)',
          '```',
        ].join('\n'),
      },
    ],
    liveMergedPrs: new Set(['122']),
  });
  assert.equal(
    warnings.some((warning) => warning.includes('docs/SESSION_HANDOFF.md') && warning.includes('PR #122')),
    false,
  );
});

test('canonical checkpoint open wording for a merged PR still warns', () => {
  const warnings = collectStaleStatusWarnings({
    projectMemory: '| CONTINUITY-04 | MERGED | PR #122 `c488b10` |',
    handoff: '',
    documents: [
      {
        name: 'docs/SESSION_HANDOFF.md',
        text: '| 2 | GitHub SHA, branch, active PR | **6015d90** on `main`. Issue #121 PR #122 on `feature/issue-121-continuity-04` (open, owner review; not merged) |',
      },
    ],
    liveMergedPrs: new Set(['122']),
  });
  assert.match(warnings.join('\n'), /PR #122/);
  assert.match(warnings.join('\n'), /stale open status/);
});

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
  assert.equal(looksLikeOpenPrClaim('[PR **#122**] on `feature/x` (open, owner review)'), true);
});

test('prNumbers parses Markdown PR references', () => {
  const text = 'Issue **#121** [PR **#122**](https://github.com/example/pull/122) (open)';
  assert.deepEqual(prNumbers(text), ['122']);
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
    assert.match(artifact.issue_writer, new RegExp(`Issue #${artifact.tracking_issue}\\b`));
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

test('c merged PR still open in checkpoint is CONFLICT with MERGED_PR_STILL_OPEN reason', () => {
  const root = mkdtempSync(join(tmpdir(), 'webxxl-open-pr-'));
  const documented = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  try {
    writeCheckpointDocs(root, documented);
    const memory = readFileSync(join(root, 'docs', 'PROJECT_MEMORY.md'), 'utf8');
    writeFileSync(
      join(root, 'docs', 'PROJECT_MEMORY.md'),
      memory.replace(
        '| 2 | GitHub SHA, branch, active PR |',
        `| 2 | GitHub SHA, branch, active PR | **\`${documented}\`** on main. [PR **#118**](https://example/pull/118) open, not merged |`,
      ),
    );
    const field2 = `| 2 | GitHub SHA, branch, active PR | **\`${documented}\`** on main. [PR **#118**](https://example/pull/118) open, not merged |`;
    const handoff = readFileSync(join(root, 'docs', 'SESSION_HANDOFF.md'), 'utf8');
    writeFileSync(join(root, 'docs', 'PROJECT_MEMORY.md'), readFileSync(join(root, 'docs', 'PROJECT_MEMORY.md'), 'utf8').replace(/\| 2 \| GitHub SHA, branch, active PR \|[^\n]+\|/, field2));
    writeFileSync(join(root, 'docs', 'SESSION_HANDOFF.md'), handoff.replace(/\| 2 \| GitHub SHA, branch, active PR \|[^\n]+\|/, field2));
    const mergedAt = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const result = reconcileContinuity(root, {
      lifecyclePhase: 'close',
      skipGitFetch: true,
      referenceMain: documented,
      mergedPrCheckFn: (pr) =>
        pr === '118'
          ? { available: true, merged: true, mergeSha: mergedAt }
          : { available: true, merged: false, mergeSha: null },
    });
    assert.equal(classifyStaleOpenMergedPr(root, documented, documented, mergedAt, false), 'contradiction');
    assert.equal(result.status, 'CONFLICT');
    assert.ok(result.conflicts.some((c) => /still describes PR #118 as open/.test(c)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('issue register IN PR cites only historical merged PR without blocking active citation', () => {
  const row =
    '| CONT-121 | IN PR | CONTINUITY-04 | [PR **#123**](https://example/pull/123) post-merge CI correction **IN PR**. Implementation merged via [PR **#122**](https://example/pull/122) @ c488b10 | notes |';
  assert.deepEqual(openPrNumbersInText(row), ['123']);
});

test('mixed-status issue register row resolves only the active open PR citation', () => {
  const row =
    '| CONT-121 | IN PR | CONTINUITY-04 | [PR **#124**](https://example/pull/124) current correction IN PR; [PR **#123**](https://example/pull/123) MERGED @ 259f6be | notes |';
  assert.deepEqual(openPrNumbersInText(row), ['124']);
});

test('live CONT-121 issue register row is RESOLVED with no open PR citation', () => {
  const register = readFileSync(join(ROOT, 'docs', 'ISSUE_REGISTER.md'), 'utf8');
  const row = register.split('\n').find((line) => line.includes('| CONT-121 |'));
  assert.ok(row);
  assert.match(row, /\|\s*CONT-121\s*\|\s*RESOLVED\s*\|/);
  assert.deepEqual(openPrNumbersInText(row), []);
});

test('live BATCH4-109 issue register row exposes PR #125 as the active open citation', () => {
  const register = readFileSync(join(ROOT, 'docs', 'ISSUE_REGISTER.md'), 'utf8');
  const row = register.split('\n').find((line) => line.includes('| BATCH4-109 |'));
  assert.ok(row);
  assert.deepEqual(openPrNumbersInText(row), ['125']);
});

test('push:main mixed-status CONT-121 row yields POST-MERGE-ISSUE-PR for active PR only', () => {
  const root = mkdtempSync(join(tmpdir(), 'webxxl-mixed-reg-push-'));
  try {
    const baseSha = initFixtureRepo(root);
    writeCheckpointDocs(root, baseSha);
    const registerRow = `| CONT-121 | IN PR | CONTINUITY-04 | [PR **#124**](https://example/pull/124) current correction IN PR; [PR **#123**](https://example/pull/123) MERGED @ 259f6be | notes |`;
    writeFileSync(join(root, 'docs', 'ISSUE_REGISTER.md'), `| id | status | item | evidence | action |\n${registerRow}\n`);
    const field2 = `| 2 | GitHub SHA, branch, active PR | **\`${baseSha}\`** on main. [PR **#124**](https://example/pull/124) open until docs catch up |`;
    for (const rel of ['docs/PROJECT_MEMORY.md', 'docs/SESSION_HANDOFF.md']) {
      writeFileSync(
        join(root, rel),
        readFileSync(join(root, rel), 'utf8').replace(/\| 2 \| GitHub SHA, branch, active PR \|[^\n]+\|/, field2),
      );
    }
    writeFileSync(join(root, 'README.md'), 'application v2 after merge\n');
    gitCmd(root, 'add', '.');
    gitCmd(root, 'commit', '-m', 'squash merge');
    const referenceMain = gitCmd(root, 'rev-parse', 'HEAD');
    const mergedPrCheckFn = (pr) =>
      pr === '124'
        ? { available: true, merged: true, mergeSha: referenceMain }
        : pr === '123'
          ? { available: true, merged: true, mergeSha: '259f6be259f6be259f6be259f6be259f6be259f6be' }
          : { available: true, merged: false, mergeSha: null };
    const pushResult = reconcileContinuity(root, {
      isMainPush: true,
      ciGitHubSha: referenceMain,
      referenceMain,
      skipGitFetch: true,
      mergedPrCheckFn,
    });
    assert.equal(pushResult.status, 'PENDING_REPOSITORY_SYNC');
    assert.equal(pushResult.conflicts.length, 0);
    assert.ok(pushResult.pending.some((p) => /POST-MERGE-ISSUE-PR-#124/.test(p)));
    assert.equal(
      pushResult.pending.some((p) => /POST-MERGE-ISSUE-PR-#123/.test(p)),
      false,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('reconciled checkpoint with mixed-status register still IN PR for merged active PR is CONFLICT', () => {
  const root = mkdtempSync(join(tmpdir(), 'webxxl-mixed-reg-conflict-'));
  const documented = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  try {
    writeCheckpointDocs(root, documented);
    writeFileSync(
      join(root, 'docs', 'ISSUE_REGISTER.md'),
      `| id | status | item | evidence | action |\n| CONT-121 | IN PR | lifecycle | [PR **#124**](https://example/pull/124) current correction IN PR; [PR **#123**](https://example/pull/123) MERGED @ 259f6be | notes |\n`,
    );
    const result = reconcileContinuity(root, {
      referenceMain: documented,
      lifecyclePhase: 'close',
      skipGitFetch: true,
      mergedPrCheckFn: (pr) =>
        pr === '124'
          ? { available: true, merged: true, mergeSha: documented }
          : { available: true, merged: true, mergeSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
    });
    assert.equal(result.status, 'CONFLICT');
    assert.ok(result.conflicts.some((c) => /ISSUE_REGISTER row still IN PR but PR #124/.test(c)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('push:main with ISSUE_REGISTER IN PR row after squash merge is PENDING not CONFLICT', () => {
  const root = mkdtempSync(join(tmpdir(), 'webxxl-issue-reg-post-merge-'));
  try {
    const baseSha = initFixtureRepo(root);
    writeCheckpointDocs(root, baseSha);
    const registerRow = `| CONT-121 | IN PR | CONTINUITY-04 lifecycle | [PR **#123**](https://example/pull/123) post-merge sync **IN PR**. Implementation merged via [PR **#122**](https://example/pull/122) @ \`${baseSha}\` | notes |`;
    writeFileSync(join(root, 'docs', 'ISSUE_REGISTER.md'), `| id | status | item | evidence | action |\n${registerRow}\n`);
    const field2 = `| 2 | GitHub SHA, branch, active PR | **\`${baseSha}\`** on main. [PR **#123**](https://example/pull/123) open until docs catch up |`;
    for (const rel of ['docs/PROJECT_MEMORY.md', 'docs/SESSION_HANDOFF.md']) {
      writeFileSync(
        join(root, rel),
        readFileSync(join(root, rel), 'utf8').replace(/\| 2 \| GitHub SHA, branch, active PR \|[^\n]+\|/, field2),
      );
    }
    writeFileSync(join(root, 'README.md'), 'application v2 after merge\n');
    gitCmd(root, 'add', '.');
    gitCmd(root, 'commit', '-m', 'squash merge on main without doc refresh');
    const referenceMain = gitCmd(root, 'rev-parse', 'HEAD');
    const mergeSha = referenceMain;
    const mergedPrCheckFn = (pr) =>
      pr === '123'
        ? { available: true, merged: true, mergeSha }
        : pr === '122'
          ? { available: true, merged: true, mergeSha: baseSha }
          : { available: true, merged: false, mergeSha: null };
  for (const lifecyclePhase of ['start', 'checkpoint', 'close', 'ci']) {
      const result = reconcileContinuity(root, {
        lifecyclePhase,
        referenceMain,
        skipGitFetch: true,
        mergedPrCheckFn,
      });
      assert.equal(result.conflicts.length, 0, `${lifecyclePhase}: ${result.conflicts.join('\n')}`);
      assert.equal(result.status, 'PENDING_REPOSITORY_SYNC', lifecyclePhase);
      assert.ok(result.pending.some((p) => /POST-MERGE-ISSUE-PR-#123/.test(p)), lifecyclePhase);
      assert.ok(result.pending.some((p) => /POST-MERGE-PR-#123/.test(p)), lifecyclePhase);
    }
    const pushResult = reconcileContinuity(root, {
      isMainPush: true,
      ciGitHubSha: referenceMain,
      lifecyclePhase: 'ci',
      referenceMain,
      skipGitFetch: true,
      mergedPrCheckFn,
    });
    assert.equal(pushResult.status, 'PENDING_REPOSITORY_SYNC');
    assert.equal(pushResult.conflicts.length, 0);
    assert.ok(pushResult.pending.some((p) => /POST-MERGE-ISSUE-PR-#123/.test(p)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('two consecutive squash merges stay PENDING without ISSUE_REGISTER conflict', () => {
  const root = mkdtempSync(join(tmpdir(), 'webxxl-double-post-merge-'));
  try {
    const baseSha = initFixtureRepo(root);
    writeCheckpointDocs(root, baseSha);
    const registerFor = (pr) =>
      `| CONT-121 | IN PR | CONTINUITY-04 lifecycle | [PR **#${pr}**](https://example/pull/${pr}) post-merge sync **IN PR** | notes |`;
    const bumpMain = (message) => {
      writeFileSync(join(root, 'README.md'), `${message}\n`);
      gitCmd(root, 'add', 'README.md');
      gitCmd(root, 'commit', '-m', message);
      return gitCmd(root, 'rev-parse', 'HEAD');
    };
    const field2For = (pr) =>
      `| 2 | GitHub SHA, branch, active PR | **\`${baseSha}\`** on main. [PR **#${pr}**](https://example/pull/${pr}) open until docs catch up |`;
    const applyDocs = (pr) => {
      writeFileSync(join(root, 'docs', 'ISSUE_REGISTER.md'), `| id | status | item | evidence | action |\n${registerFor(pr)}\n`);
      for (const rel of ['docs/PROJECT_MEMORY.md', 'docs/SESSION_HANDOFF.md']) {
        writeFileSync(
          join(root, rel),
          readFileSync(join(root, rel), 'utf8').replace(/\| 2 \| GitHub SHA, branch, active PR \|[^\n]+\|/, field2For(pr)),
        );
      }
    };
    applyDocs('123');
    const firstMerge = bumpMain('first squash merge');
    let mergedPrCheckFn = (pr) =>
      pr === '123'
        ? { available: true, merged: true, mergeSha: firstMerge }
        : { available: true, merged: false, mergeSha: null };
    let result = reconcileContinuity(root, {
      isMainPush: true,
      ciGitHubSha: firstMerge,
      referenceMain: firstMerge,
      skipGitFetch: true,
      mergedPrCheckFn,
    });
    assert.equal(result.status, 'PENDING_REPOSITORY_SYNC');
    assert.equal(result.conflicts.length, 0);
    assert.ok(result.pending.some((p) => /POST-MERGE-ISSUE-PR-#123/.test(p)));

    applyDocs('124');
    const secondMerge = bumpMain('second squash merge');
    mergedPrCheckFn = (pr) => {
      if (pr === '124') return { available: true, merged: true, mergeSha: secondMerge };
      if (pr === '123') return { available: true, merged: true, mergeSha: firstMerge };
      return { available: true, merged: false, mergeSha: null };
    };
    result = reconcileContinuity(root, {
      isMainPush: true,
      ciGitHubSha: secondMerge,
      referenceMain: secondMerge,
      skipGitFetch: true,
      mergedPrCheckFn,
    });
    assert.equal(result.status, 'PENDING_REPOSITORY_SYNC');
    assert.equal(result.conflicts.length, 0);
    assert.ok(result.pending.some((p) => /POST-MERGE-ISSUE-PR-#124/.test(p)));
    assert.ok(result.pending.some((p) => /POST-MERGE-PR-#124/.test(p)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('reconciled checkpoint with ISSUE_REGISTER still IN PR for merged PR is CONFLICT', () => {
  const root = mkdtempSync(join(tmpdir(), 'webxxl-issue-reg-contradiction-'));
  const documented = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  try {
    writeCheckpointDocs(root, documented);
    writeFileSync(
      join(root, 'docs', 'ISSUE_REGISTER.md'),
      `| id | status | item | evidence | action |\n| CONT-121 | IN PR | lifecycle | [PR **#123**](https://example/pull/123) still open | notes |\n`,
    );
    const resolved = resolveMergedOpenPrDrift(
      root,
      documented,
      documented,
      '123',
      { available: true, merged: true, mergeSha: documented },
      { lifecyclePhase: 'close' },
      'issue_register',
    );
    assert.equal(resolved.outcome, 'conflict');
    const result = reconcileContinuity(root, {
      referenceMain: documented,
      lifecyclePhase: 'close',
      skipGitFetch: true,
      mergedPrCheckFn: () => ({ available: true, merged: true, mergeSha: documented }),
    });
    assert.equal(result.status, 'CONFLICT');
    assert.ok(result.conflicts.some((c) => /ISSUE_REGISTER row still IN PR but PR #123/.test(c)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('just-merged PR open wording on push:main is post-merge sync not stale contradiction', () => {
  const root = mkdtempSync(join(tmpdir(), 'webxxl-post-merge-pr-'));
  try {
    const baseSha = initFixtureRepo(root);
    writeFileSync(join(root, 'README.md'), 'application v2 after merge\n');
    gitCmd(root, 'add', 'README.md');
    gitCmd(root, 'commit', '-m', 'simulate squash merge on main');
    const referenceMain = gitCmd(root, 'rev-parse', 'HEAD');
    const mergeSha = referenceMain;
    writeCheckpointDocs(root, baseSha);
    const field2 = `| 2 | GitHub SHA, branch, active PR | **\`${baseSha}\`** on main. [PR **#118**](https://example/pull/118) open until docs catch up |`;
    for (const rel of ['docs/PROJECT_MEMORY.md', 'docs/SESSION_HANDOFF.md']) {
      writeFileSync(
        join(root, rel),
        readFileSync(join(root, rel), 'utf8').replace(/\| 2 \| GitHub SHA, branch, active PR \|[^\n]+\|/, field2),
      );
    }
    assert.equal(
      classifyStaleOpenMergedPr(root, baseSha, referenceMain, mergeSha, true),
      'post_merge_sync',
    );
    const reconcileOpts = {
      referenceMain,
      skipGitFetch: true,
      mergedPrCheckFn: () => ({ available: true, merged: true, mergeSha }),
    };
    for (const lifecyclePhase of ['start', 'checkpoint', 'close']) {
      const result = reconcileContinuity(root, { ...reconcileOpts, lifecyclePhase });
      assert.equal(result.conflicts.length, 0, `${lifecyclePhase}: ${result.conflicts.join('\n')}`);
      assert.ok(result.pending.some((p) => /POST-MERGE-PR-#118/.test(p)), lifecyclePhase);
      assert.ok(result.pending.some((p) => /POST-MERGE-CHECKPOINT/i.test(p)), lifecyclePhase);
      assert.equal(result.status, 'PENDING_REPOSITORY_SYNC', lifecyclePhase);
    }
    const pushResult = reconcileContinuity(root, {
      ...reconcileOpts,
      isMainPush: true,
      ciGitHubSha: referenceMain,
      lifecyclePhase: 'ci',
    });
    assert.equal(pushResult.status, 'PENDING_REPOSITORY_SYNC');
    assert.ok(pushResult.pending.some((p) => /POST-MERGE-PR-#118/.test(p)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('continuity CLI treats --json as a flag not repository root', () => {
  const parsed = parseContinuityCliArgs(['node', 'continuity-start.mjs', '--json']);
  assert.equal(parsed.json, true);
  assert.match(parsed.root, /webxxl-website-system|Projects/i);
  const withRoot = parseContinuityCliArgs(['node', 'continuity-start.mjs', '/tmp/repo', '--json']);
  assert.equal(withRoot.json, true);
  assert.equal(withRoot.root, resolve('/tmp/repo'));
});

test('a current repo lifecycle close has no deterministic conflicts after CONTINUITY-04 reconcile', () => {
  const { payload } = runContinuityLifecycle(ROOT, { phase: 'close', skipGitFetch: true, referenceMain: firstSha(parseSixFieldCheckpoint(readFileSync(join(ROOT, 'docs', 'PROJECT_MEMORY.md'), 'utf8'))['2']) });
  assert.equal(payload.conflicts.length, 0, payload.conflicts.join('\n'));
  assert.notEqual(payload.status, 'CONFLICT');
});

test('continuity live status marks bot writer disabled', () => {
  const live = buildContinuityLiveStatus({ status: 'PENDING_REPOSITORY_SYNC', reasonCode: 'CHECKPOINT_LAGS_LIVE_MAIN', conflicts: [], pending: ['x'], facts: {} }, 'aaaa', { available: true, prs: [] });
  assert.equal(live.bot_docs_sync_pr.enabled, false);
  assert.match(live.note, /Green CI does not imply/);
});

test('operational anchors reject stale CHATGPT verified main claim', () => {
  const root = mkdtempSync(join(tmpdir(), 'webxxl-anchor-'));
  try {
  const main = 'cccccccccccccccccccccccccccccccccccccccc';
  writeCheckpointDocs(root, main);
    writeFileSync(
      join(root, 'docs', 'CHATGPT_PROJECT_INSTRUCTIONS.md'),
      `Checkpoint written 2026-01-01: verified \`main\` is \`deadbeefdeadbeefdeadbeefdeadbeefdeadbeef\``,
    );
    const { errors } = validateOperationalAnchors(root);
    assert.ok(errors.length >= 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('docs snapshot write is idempotent when snapshot unchanged', () => {
  const root = mkdtempSync(join(tmpdir(), 'webxxl-snapshot-'));
  const snapPath = join(root, 'snap.json');
  try {
    const main = 'dddddddddddddddddddddddddddddddddddddddd';
    writeCheckpointDocs(root, main);
    const snapshot = proposeCheckpointSnapshot({
      reconciledMainSha: main,
      field1Summary: 'test field 1',
      field2Summary: `**\`${main}\`** on main`,
      field3Deployment: 'UNVERIFIED',
      field4Date: '2026-11-08',
      field5Next: 'wait',
      field6Blockers: 'none',
    });
    writeFileSync(snapPath, JSON.stringify(snapshot));
    const first = applySnapshotFromFile(root, snapPath);
    const second = applySnapshotFromFile(root, snapPath);
    assert.equal(first.changed, true);
    assert.equal(second.idempotent, true);
    assert.equal(second.changed, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('g duplicate ADR index status mismatch is reported', () => {
  const root = mkdtempSync(join(tmpdir(), 'webxxl-adr-'));
  try {
    cpSync(join(ROOT, 'docs', 'adr'), join(root, 'docs', 'adr'), { recursive: true });
    mkdirSync(join(root, 'docs', 'platform', 'docs'), { recursive: true });
    writeFileSync(
      join(root, 'docs', 'platform', 'docs', '15-DECISIONS-CHANGELOG.md'),
      readFileSync(join(ROOT, 'docs', 'platform', 'docs', '15-DECISIONS-CHANGELOG.md')),
    );
    let index = readFileSync(join(root, 'docs', 'adr', 'INDEX.md'), 'utf8');
    index = index.replace('| ADR-018 |', '| ADR-018 |').replace('| PROPOSED |', '| APPROVED |');
    index = index.replace(
      '| ADR-018 | Component adoption vs whole-platform replacement | PROPOSED |',
      '| ADR-018 | Component adoption vs whole-platform replacement | APPROVED |',
    );
    writeFileSync(join(root, 'docs', 'adr', 'INDEX.md'), index);
    const { errors } = validateAdrs(root);
    assert.ok(errors.some((e) => /INDEX\.md/.test(e) && /ADR-018/.test(e)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
