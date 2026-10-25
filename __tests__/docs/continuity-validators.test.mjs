import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyDivergence } from '../../scripts/check-branch-divergence.mjs';
import { assessEvidence } from '../../scripts/check-deployment-evidence.mjs';
import { buildHandoffDraft } from '../../scripts/draft-session-handoff.mjs';
import { validateContinuity } from '../../scripts/validate-continuity.mjs';
import { validateGenerated } from '../../scripts/validate-generated.mjs';
import { validateNavHrefs } from '../../scripts/validate-routes.mjs';
import { validateRoutes } from '../../scripts/validate-routes.mjs';
import { validateSeo, validateStaticPaths } from '../../scripts/validate-seo.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

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
