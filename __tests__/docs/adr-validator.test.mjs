import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAdrs } from '../../scripts/validate-adr.mjs';

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
