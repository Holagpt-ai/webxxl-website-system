import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  adrHasApprovedCitationInDecisionLog,
  lineExplicitApprovedForAdr,
  lineExplicitApprovedForEvidence,
  validateAdrs,
} from '../../scripts/validate-adr.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('proposed ADR directory validates', () => {
  const result = validateAdrs(ROOT);
  assert.equal(result.checked, 3);
  assert.deepEqual(result.errors, []);
});

test('approved ADR without decision proof fails', () => {
  const root = mkdtempSync(join(tmpdir(), 'webxxl-adr-'));
  try {
    cpSync(join(ROOT, 'docs', 'adr'), join(root, 'docs', 'adr'), { recursive: true });
    const filename = join(root, 'docs', 'adr', 'ADR-018-selective-provider-integration-policy.md');
    writeFileSync(filename, readFileSync(filename, 'utf8').replace('status: PROPOSED', 'status: APPROVED'));
    assert.match(validateAdrs(root).errors.join('\n'), /APPROVED requires non-NONE owner decision evidence/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('approved ADR without canonical decision log citation fails', () => {
  const root = mkdtempSync(join(tmpdir(), 'webxxl-adr-'));
  try {
    cpSync(join(ROOT, 'docs', 'adr'), join(root, 'docs', 'adr'), { recursive: true });
    mkdirSync(join(root, 'docs', 'platform', 'docs'), { recursive: true });
    writeFileSync(
      join(root, 'docs', 'platform', 'docs', '15-DECISIONS-CHANGELOG.md'),
      '# decisions\n\nLegacy ADR-001 only.\n',
    );
    const filename = join(root, 'docs', 'adr', 'ADR-018-selective-provider-integration-policy.md');
    let body = readFileSync(filename, 'utf8');
    body = body.replace('status: PROPOSED', 'status: APPROVED');
    body = body.replace('approval_evidence: NONE', 'approval_evidence: owner-decision-2026-10-99');
    writeFileSync(filename, body);
    assert.match(validateAdrs(root).errors.join('\n'), /15-DECISIONS-CHANGELOG\.md/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('ADR approval citation rejects PROPOSED, NOT APPROVED, REJECTED-only, and cross-ADR evidence', () => {
  assert.equal(
    adrHasApprovedCitationInDecisionLog(
      'ADR-018 selective integration — status PROPOSED pending owner review.',
      'ADR-018',
      'owner-note-1',
    ),
    false,
  );
  assert.equal(
    adrHasApprovedCitationInDecisionLog('ADR-018 remains NOT APPROVED pending review.', 'ADR-018', 'owner-note-1'),
    false,
  );
  assert.equal(
    adrHasApprovedCitationInDecisionLog('ADR-018 — REJECTED by owner 2026-10-25.', 'ADR-018', 'owner-note-1'),
    false,
  );
  assert.equal(
    adrHasApprovedCitationInDecisionLog(
      'ADR-019 — APPROVED (owner-decision-2026-10-99).',
      'ADR-018',
      'owner-decision-2026-10-99',
    ),
    false,
  );
  assert.equal(
    lineExplicitApprovedForAdr('ADR-018 status PROPOSED; APPROVED later on ADR-019 only.', 'ADR-018'),
    false,
  );
});

test('ADR approval citation accepts exact ID and matching evidence APPROVED lines', () => {
  const log = [
    'ADR-018 — APPROVED by owner 2026-10-25.',
    'Owner record owner-decision-2026-10-25: ADR-018 APPROVED.',
  ].join('\n');
  assert.equal(lineExplicitApprovedForAdr('ADR-018 — APPROVED by owner 2026-10-25.', 'ADR-018'), true);
  assert.equal(
    lineExplicitApprovedForEvidence(
      'Owner record owner-decision-2026-10-25: ADR-018 APPROVED.',
      'ADR-018',
      'owner-decision-2026-10-25',
    ),
    true,
  );
  assert.equal(adrHasApprovedCitationInDecisionLog(log, 'ADR-018', 'owner-decision-2026-10-25'), true);
});

test('superseded_by without reciprocal supersedes fails', () => {
  const root = mkdtempSync(join(tmpdir(), 'webxxl-adr-super-'));
  try {
    cpSync(join(ROOT, 'docs', 'adr'), join(root, 'docs', 'adr'), { recursive: true });
    mkdirSync(join(root, 'docs', 'platform', 'docs'), { recursive: true });
    writeFileSync(
      join(root, 'docs', 'platform', 'docs', '15-DECISIONS-CHANGELOG.md'),
      readFileSync(join(ROOT, 'docs', 'platform', 'docs', '15-DECISIONS-CHANGELOG.md')),
    );
    const path018 = join(root, 'docs', 'adr', 'ADR-018-selective-provider-integration-policy.md');
    writeFileSync(path018, readFileSync(path018, 'utf8').replace('supersedes: NONE', 'supersedes: ADR-019'));
    const errors = validateAdrs(root).errors.join('\n');
    assert.match(errors, /supersedes ADR-019 but ADR-019 superseded_by does not reciprocate ADR-018/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('ADR-019 superseded_by without reciprocal supersedes on successor fails', () => {
  const root = mkdtempSync(join(tmpdir(), 'webxxl-adr-super-2-'));
  try {
    cpSync(join(ROOT, 'docs', 'adr'), join(root, 'docs', 'adr'), { recursive: true });
    mkdirSync(join(root, 'docs', 'platform', 'docs'), { recursive: true });
    writeFileSync(
      join(root, 'docs', 'platform', 'docs', '15-DECISIONS-CHANGELOG.md'),
      readFileSync(join(ROOT, 'docs', 'platform', 'docs', '15-DECISIONS-CHANGELOG.md')),
    );
    const path019 = join(root, 'docs', 'adr', 'ADR-019-cms-adapter-decision-gate.md');
    writeFileSync(path019, readFileSync(path019, 'utf8').replace('superseded_by: NONE', 'superseded_by: ADR-020'));
    const errors = validateAdrs(root).errors.join('\n');
    assert.match(errors, /ADR-019: superseded_by ADR-020 but ADR-020 supersedes does not reciprocate ADR-019/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('legacy reserved ADR IDs cannot be created as new numbered files', () => {
  const root = mkdtempSync(join(tmpdir(), 'webxxl-adr-'));
  try {
    cpSync(join(ROOT, 'docs', 'adr'), join(root, 'docs', 'adr'), { recursive: true });
    const path = join(root, 'docs', 'adr', 'ADR-017-duplicate-legacy.md');
    const source = readFileSync(join(ROOT, 'docs', 'adr', 'ADR-018-selective-provider-integration-policy.md'), 'utf8');
    writeFileSync(path, source.replace('id: ADR-018', 'id: ADR-017'));
    assert.match(validateAdrs(root).errors.join('\n'), /reserved for legacy decision log/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
