let seq = 0

export function nextCustomerAiPublicId(prefix: 'wae' | 'wak' | 'wacs'): string {
  seq += 1
  return `${prefix}_${Date.now().toString(36)}_${seq.toString(36)}`
}
