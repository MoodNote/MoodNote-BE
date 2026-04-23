export interface PaginationMeta {
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

/**
 * Calculates the number of records to skip for a given page/limit pair.
 */
export function calcSkip(page: number, limit: number): number {
	return (page - 1) * limit;
}

/**
 * Builds the standard pagination metadata object.
 */
export function buildPagination(
	total: number,
	page: number,
	limit: number,
): PaginationMeta {
	const safeLimit = Math.max(1, limit);
	return {
		total,
		page,
		limit: safeLimit,
		totalPages: Math.ceil(total / safeLimit),
	};
}
