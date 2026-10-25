#!/usr/bin/env node
/**
 * Validate a deployment evidence JSON file. No network, no git writes.
 * With no file, print UNVERIFIED and exit 0.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED = [
  'environment', 'service', 'released_at_utc', 'git_sha', 'deployment_id',
  'state', 'evidence_url', 'migration_ids_applied', 'flags', 'provider_scope', 'result',
];

export function assessEvidence(value) {
  if (!value) return { errors: [], summary: 'UNVERIFIED: no deployment evidence file was provided' };
  const errors = [];
  for (const key of REQUIRED) if (!value[key]) errors.push(`missing ${key}`);
  if (value.git_sha && !/^[0-9a-f]{40}$/.test(value.git_sha)) errors.push('git_sha must be 40 hex characters');
  if (value.result === 'VERIFIED_LIVE' && (value.migration_ids_applied === 'UNVERIFIED' || value.flags === 'UNVERIFIED')) {
    errors.push('VERIFIED_LIVE cannot be claimed while migrations or flags are UNVERIFIED');
  }
  const summary = errors.length
    ? `INVALID: ${errors.join('; ')}`
    : `${value.result}: ${value.environment} ${value.git_sha} deployment ${value.deployment_id}`;
  return { errors, summary };
}

export function evidenceFiles(root) {
  const dir = join(root, 'docs', 'deployment-evidence');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => name.endsWith('.json')).map((name) => join(dir, name));
}

function reportFor(root) {
  const selected = process.env.WEBXXL_DEPLOYMENT_EVIDENCE;
  const files = selected ? [resolve(selected)] : evidenceFiles(root);
  if (!files.length) return assessEvidence(null);
  const errors = [];
  const lines = [];
  for (const file of files) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      errors.push(`${file}: invalid JSON`);
      continue;
    }
    const result = assessEvidence(parsed);
    errors.push(...result.errors.map((error) => `${file}: ${error}`));
    lines.push(result.summary);
  }
  return { errors, summary: lines.join('\n') };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] || process.cwd());
  const result = reportFor(root);
  const text = `${result.summary}\n${result.errors.map((error) => `ERROR: ${error}`).join('\n')}`.trim() + '\n';
  process.stdout.write(text);
  if (process.env.WEBXXL_DEPLOYMENT_REPORT) writeFileSync(process.env.WEBXXL_DEPLOYMENT_REPORT, text);
  if (result.errors.length) process.exitCode = 1;
}
