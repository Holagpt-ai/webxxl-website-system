#!/usr/bin/env node
/**
 * Tracked migration folders and the platform package checksum.
 * Prisma Client is generated, not committed. This script does not generate it.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function validateMigrationFolders(migrationsDir) {
  const errors = [];
  if (!existsSync(migrationsDir)) return ['prisma/migrations is missing'];
  for (const name of readdirSync(migrationsDir)) {
    const full = join(migrationsDir, name);
    if (!statSync(full).isDirectory()) continue;
    if (!existsSync(join(full, 'migration.sql'))) errors.push(`${name} is missing migration.sql`);
  }
  return errors;
}

export function canonicalBytes(file, bytes) {
  if (file.endsWith('.png')) return bytes;
  return Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
}

export function validatePlatformChecksums(platformDir) {
  const sumPath = join(platformDir, 'SHA256SUMS.txt');
  if (!existsSync(sumPath)) return ['docs/platform/SHA256SUMS.txt is missing'];
  const errors = [];
  const lines = readFileSync(sumPath, 'utf8').split(/\r?\n/).filter((line) => line.trim());
  for (const line of lines) {
    const match = line.match(/^([a-f0-9]{64})\s+(.+)$/);
    if (!match) {
      errors.push(`unreadable checksum line: ${line}`);
      continue;
    }
    const file = join(platformDir, match[2]);
    if (!existsSync(file)) {
      errors.push(`checksum target missing: ${match[2]}`);
      continue;
    }
    const hash = createHash('sha256').update(canonicalBytes(file, readFileSync(file))).digest('hex');
    if (hash !== match[1]) errors.push(`checksum mismatch: ${match[2]}`);
  }
  return errors;
}

export function validateGenerated(root) {
  const errors = [
    ...validateMigrationFolders(join(root, 'prisma', 'migrations')),
    ...validatePlatformChecksums(join(root, 'docs', 'platform')),
  ];
  if (existsSync(join(root, 'prisma', 'generated'))) {
    errors.push('prisma/generated must not be committed; Prisma Client is generated in CI and locally');
  }
  return { errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validateGenerated(resolve(process.argv[2] || process.cwd()));
  for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
  process.stdout.write(`WebXXL generated-artifact check: ${result.errors.length} errors\n`);
  if (result.errors.length) process.exitCode = 1;
}
