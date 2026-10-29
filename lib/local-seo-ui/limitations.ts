import type { GscPerformance } from '@/lib/local-seo-ui/types'

/** Merge API `gsc.completeness.limitations` with top-level `limitations[]` without duplicate lines. */
export function mergeGscLimitationMessages(gsc: GscPerformance | undefined, responseLimitations?: string[]): string[] {
  const fromAggregate = gsc?.completeness?.limitations ?? []
  const fromResponse = responseLimitations ?? []
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of [...fromAggregate, ...fromResponse]) {
    const trimmed = line.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}
