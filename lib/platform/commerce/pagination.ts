export type PageParams = {
  take: number
  skip: number
}

export type PageResult<T> = {
  items: T[]
  pagination: {
    take: number
    skip: number
    total: number
    hasMore: boolean
  }
}

const DEFAULT_TAKE = 25
const MAX_TAKE = 100

export function parsePageParams(searchParams: URLSearchParams): PageParams {
  const takeRaw = searchParams.get('take')
  const skipRaw = searchParams.get('skip')
  let take = DEFAULT_TAKE
  let skip = 0
  if (takeRaw != null && takeRaw !== '') {
    const n = Number(takeRaw)
    if (Number.isFinite(n) && n >= 1) take = Math.min(Math.floor(n), MAX_TAKE)
  }
  if (skipRaw != null && skipRaw !== '') {
    const n = Number(skipRaw)
    if (Number.isFinite(n) && n >= 0) skip = Math.floor(n)
  }
  return { take, skip }
}

export function pageResult<T>(items: T[], total: number, params: PageParams): PageResult<T> {
  return {
    items,
    pagination: {
      take: params.take,
      skip: params.skip,
      total,
      hasMore: params.skip + items.length < total,
    },
  }
}
