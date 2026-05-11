interface PaginationOptions {
    defaultPage?: number
    defaultLimit?: number
    maxLimit?: number
}

export function parsePagination(searchParams: URLSearchParams, options: PaginationOptions = {}) {
    const defaultPage = options.defaultPage ?? 1
    const defaultLimit = options.defaultLimit ?? 50
    const maxLimit = options.maxLimit ?? 100

    const rawPage = Number.parseInt(searchParams.get('page') || `${defaultPage}`, 10)
    const rawLimit = Number.parseInt(searchParams.get('limit') || `${defaultLimit}`, 10)
    const rawOffset = Number.parseInt(searchParams.get('offset') || '', 10)

    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : defaultPage
    const requestedLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : defaultLimit
    const limit = Math.min(requestedLimit, maxLimit)
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : (page - 1) * limit

    return {
        page,
        limit,
        offset,
        from: offset,
        to: offset + limit - 1,
    }
}
