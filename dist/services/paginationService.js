"use strict";
/**
 * paginationService
 *
 * Helpers for opt-in server-side pagination.
 *
 * Key design principle: pagination is OPT-IN. When the caller does not send
 * `page`/`pageSize`, `isPaginated` is `false` and the controller must behave
 * exactly as before (return a flat array, no limit/offset). This preserves
 * backward compatibility with all existing consumers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePagination = parsePagination;
exports.buildPaginatedResponse = buildPaginatedResponse;
/** Hard ceiling for pageSize to prevent abuse. */
const MAX_PAGE_SIZE = 200;
/** Default page size when pagination is requested but pageSize is omitted. */
const DEFAULT_PAGE_SIZE = 50;
/**
 * Parse pagination params from an Express `req.query`-like object.
 * Returns `isPaginated: false` when neither `page` nor `pageSize` is present,
 * so callers can skip pagination entirely and preserve legacy behavior.
 */
function parsePagination(query) {
    const rawPage = query.page;
    const rawPageSize = query.pageSize;
    const hasPage = rawPage !== undefined && rawPage !== null && rawPage !== '';
    const hasPageSize = rawPageSize !== undefined && rawPageSize !== null && rawPageSize !== '';
    if (!hasPage && !hasPageSize) {
        return { page: 1, pageSize: DEFAULT_PAGE_SIZE, limit: 0, offset: 0, isPaginated: false };
    }
    let page = Number(rawPage !== null && rawPage !== void 0 ? rawPage : 1);
    let pageSize = Number(rawPageSize !== null && rawPageSize !== void 0 ? rawPageSize : DEFAULT_PAGE_SIZE);
    if (!Number.isFinite(page) || page < 1)
        page = 1;
    if (!Number.isFinite(pageSize) || pageSize < 1)
        pageSize = DEFAULT_PAGE_SIZE;
    if (pageSize > MAX_PAGE_SIZE)
        pageSize = MAX_PAGE_SIZE;
    return {
        page,
        pageSize,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        isPaginated: true,
    };
}
/**
 * Wrap a rows array into a paginated response envelope when `isPaginated` is
 * true, otherwise return the rows array as-is (legacy behavior).
 */
function buildPaginatedResponse(rows, total, pagination) {
    if (!pagination.isPaginated)
        return rows;
    return {
        rows,
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
    };
}
