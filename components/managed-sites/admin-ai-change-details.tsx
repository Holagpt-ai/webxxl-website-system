import Link from 'next/link'
import { parseAiContentDraftV1 } from '@/lib/managed-sites/ai/schema'

export function AdminAiContentChangeDetails({
  change,
  requestsPrefix,
}: {
  change: {
    id: string
    status: string
    requestText: string | null
    structuredPayload: unknown
    changeRequestId: string | null
  }
  requestsPrefix: string
}) {
  if (!change.requestText) return null
  const draft = parseAiContentDraftV1(change.structuredPayload)
  if (!draft) {
    return <p className="mt-2 text-sm text-muted-foreground">{change.requestText}</p>
  }

  return (
    <div className="mt-2 space-y-2 text-sm">
      <div>
        <p className="font-medium">Customer request</p>
        <p className="text-muted-foreground whitespace-pre-wrap">{change.requestText}</p>
      </div>
      <div>
        <p className="font-medium">AI summary</p>
        <p className="text-muted-foreground">{draft.summary}</p>
      </div>
      <div>
        <p className="font-medium">Proposed changes</p>
        <ul className="mt-1 space-y-2">
          {draft.proposedChanges.map((item, index) => (
            <li key={`${item.location}-${index}`} className="rounded border p-2">
              <p>
                {item.location} · {item.action}
              </p>
              <p className="whitespace-pre-wrap text-muted-foreground">{item.proposedText}</p>
              {item.notes && <p className="text-xs text-muted-foreground">Notes: {item.notes}</p>}
            </li>
          ))}
        </ul>
      </div>
      {draft.assumptions.length > 0 && (
        <div>
          <p className="font-medium">Assumptions</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {draft.assumptions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {draft.clarifyingQuestions.length > 0 && (
        <div>
          <p className="font-medium">Clarifying questions</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {draft.clarifyingQuestions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {change.status === 'ESCALATED' && change.changeRequestId && (
        <p>
          <Link href={`${requestsPrefix}/admin/requests`} className="text-primary hover:underline">
            View change request queue
          </Link>
        </p>
      )}
    </div>
  )
}
