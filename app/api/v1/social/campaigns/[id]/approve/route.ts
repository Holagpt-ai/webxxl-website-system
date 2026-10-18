import { NextResponse } from 'next/server'
import { requireSocialApiActor, SocialApiError } from '@/lib/platform/social/route-auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  try {
    await params
    await requireSocialApiActor()
    return NextResponse.json(
      {
        code: 'PENDING_PILOT',
        message:
          'Human approval is enforced in domain services and Vitest; Prisma-backed approve route ships after migration apply and trusted session hydration.',
      },
      { status: 501 },
    )
  } catch (error) {
    if (error instanceof SocialApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
  }
}
