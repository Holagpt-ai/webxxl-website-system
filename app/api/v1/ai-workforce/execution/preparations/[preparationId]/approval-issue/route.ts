import { issueApprovalFromRequest } from '@/lib/platform/ai-workforce-execution/http'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  context: { params: Promise<{ preparationId: string }> },
) {
  const { preparationId } = await context.params
  return issueApprovalFromRequest(request, preparationId)
}
