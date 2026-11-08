/**
 * Parse continuity CLI flags without treating `--json` as the repository root.
 */
import { resolve } from 'node:path';

/**
 * @param {string[]} argv process.argv
 * @returns {{ root: string, json: boolean, write: boolean, print: boolean, file: string | null }}
 */
export function parseContinuityCliArgs(argv) {
  const args = argv.slice(2);
  const json = args.includes('--json');
  const write = args.includes('--write');
  const print = args.includes('--print');
  const fileIdx = args.indexOf('--file');
  const file = fileIdx >= 0 && args[fileIdx + 1] && !args[fileIdx + 1].startsWith('-') ? args[fileIdx + 1] : null;
  const positional = args.filter((a, i) => !a.startsWith('-') && (fileIdx < 0 || i !== fileIdx + 1));
  const root = resolve(positional[0] || process.cwd());
  return { root, json, write, print, file };
}
