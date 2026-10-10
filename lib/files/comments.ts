import { customerCommentVisibility, parseStaffCommentVisibility } from '@/lib/files/access'

export const MAX_COMMENT_LENGTH = 5000

export type CommentWrite =
  | {
      ok: true
      data: {
        projectId: string
        authorUserId: string
        body: string
        visibility: 'CUSTOMER' | 'INTERNAL'
      }
    }
  | { ok: false; error: 'empty' | 'too_long' | 'invalid_visibility' }

function normalizeBody(body: string): { ok: true; body: string } | { ok: false; error: 'empty' | 'too_long' } {
  const trimmed = body.trim()
  if (!trimmed) return { ok: false, error: 'empty' }
  if (trimmed.length > MAX_COMMENT_LENGTH) return { ok: false, error: 'too_long' }
  return { ok: true, body: trimmed }
}

/** Customer messages are always CUSTOMER-visible. A client visibility value is ignored. */
export function buildCustomerCommentWrite(input: {
  projectId: string
  authorUserId: string
  body: string
  visibility?: unknown
}): CommentWrite {
  const body = normalizeBody(input.body)
  if (!body.ok) return body
  return {
    ok: true,
    data: {
      projectId: input.projectId,
      authorUserId: input.authorUserId,
      body: body.body,
      visibility: customerCommentVisibility(),
    },
  }
}

export function buildStaffCommentWrite(input: {
  projectId: string
  authorUserId: string
  body: string
  visibility: unknown
}): CommentWrite {
  const body = normalizeBody(input.body)
  if (!body.ok) return body
  const visibility = parseStaffCommentVisibility(input.visibility)
  if (!visibility) return { ok: false, error: 'invalid_visibility' }
  return {
    ok: true,
    data: {
      projectId: input.projectId,
      authorUserId: input.authorUserId,
      body: body.body,
      visibility,
    },
  }
}
