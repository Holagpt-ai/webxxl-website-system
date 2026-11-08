/**
 * Cross-check durable "current" anchors against the canonical six-field checkpoint (CONTINUITY-04).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { firstSha, parseSixFieldCheckpoint, shasPrefixMatch } from './continuity-parse.mjs';

const FALSE_CURRENT_PATTERNS = [
  {
    rel: 'docs/CHATGPT_PROJECT_INSTRUCTIONS.md',
    test: (text, documentedMain) => {
      const errors = [];
      const anchor = text.match(/Checkpoint written[^:]*:\s*verified\s*`main`\s*is\s*`([^`]+)`/i);
      if (anchor && documentedMain && !shasPrefixMatch(anchor[1], documentedMain)) {
        errors.push(
          'CHATGPT_PROJECT_INSTRUCTIONS.md embeds a stale verified main SHA; refresh from GitHub or remove the static current SHA claim',
        );
      }
      return errors;
    },
  },
  {
    rel: 'docs/platform/docs/02-CURRENT-STATE.md',
    test: (text, documentedMain) => {
      const errors = [];
      const header = text.match(/\*\*Operational checkpoint[^:]*:\*\*[^`]*`([0-9a-f]{7,40})`/i);
      if (header && documentedMain && !shasPrefixMatch(header[1], documentedMain)) {
        errors.push('02-CURRENT-STATE.md operational checkpoint header names a different main SHA than checkpoint field 2');
      }
      return errors;
    },
  },
];

export function validateOperationalAnchors(root) {
  const memoryPath = join(root, 'docs', 'PROJECT_MEMORY.md');
  const errors = [];
  const warnings = [];
  if (!existsSync(memoryPath)) return { errors: ['PROJECT_MEMORY.md missing'], warnings };
  const documentedMain = firstSha(parseSixFieldCheckpoint(readFileSync(memoryPath, 'utf8'))['2'] ?? '');
  for (const rule of FALSE_CURRENT_PATTERNS) {
    const path = join(root, rule.rel);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, 'utf8');
    errors.push(...rule.test(text, documentedMain));
  }
  const adrReadme = join(root, 'docs', 'adr', 'README.md');
  if (existsSync(adrReadme)) {
    const text = readFileSync(adrReadme, 'utf8');
    if (/\*\*Immediate priority remains BATCH-15\b/i.test(text)) {
      warnings.push(
        'docs/adr/README.md still frames Batch 15 as immediate priority; align with PROJECT_MEMORY checkpoint for current queue',
      );
    }
  }
  return { errors, warnings };
}
