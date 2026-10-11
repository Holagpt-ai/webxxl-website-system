import type { AiContentDraftV1 } from '@/lib/managed-sites/ai/types'

const ACTION_LABEL: Record<AiContentDraftV1['proposedChanges'][number]['action'], string> = {
  replace: 'Replace',
  rewrite: 'Rewrite',
  add: 'Add',
  remove: 'Remove',
}

export function buildAiContentChangeRequestDescription(requestText: string, draft: AiContentDraftV1): string {
  const lines: string[] = []
  lines.push('Customer request:')
  lines.push(requestText.trim())
  lines.push('')
  lines.push('AI draft summary:')
  lines.push(draft.summary)
  lines.push('')
  lines.push('Proposed changes:')
  draft.proposedChanges.forEach((change, index) => {
    lines.push(`${index + 1}. ${change.location} — ${ACTION_LABEL[change.action]}`)
    lines.push(`   "${change.proposedText}"`)
    if (change.notes) lines.push(`   Notes: ${change.notes}`)
  })
  if (draft.assumptions.length > 0) {
    lines.push('')
    lines.push('Assumptions:')
    draft.assumptions.forEach((item) => lines.push(`- ${item}`))
  }
  if (draft.clarifyingQuestions.length > 0) {
    lines.push('')
    lines.push('Questions:')
    draft.clarifyingQuestions.forEach((item) => lines.push(`- ${item}`))
  }
  return lines.join('\n')
}
