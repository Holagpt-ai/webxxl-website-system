import { NextResponse } from 'next/server'
import { getCatalogProduct } from '@/lib/platform/commerce/engine'
import { commerceDisabledResponse, commerceRouteError, toCommerceActor } from '@/lib/platform/commerce/http'
import { prismaCommerceStore } from '@/lib/platform/commerce/prisma-store'
import { requireUser } from '@/lib/portal/authz'

type Params = { params: Promise<{ productKey: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const disabled = commerceDisabledResponse()
    if (disabled) return disabled
    const user = await requireUser()
    const { productKey } = await params
    const product = await getCatalogProduct(prismaCommerceStore, toCommerceActor(user), productKey)
    if (!product) return NextResponse.json({ code: 'PRICE_UNAVAILABLE' }, { status: 404 })
    return NextResponse.json({ product })
  } catch (error) {
    return commerceRouteError(error)
  }
}
