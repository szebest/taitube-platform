export type PaginatedResponse<T> = {
	data: T[]
	count: number;
	pageNumber: number;
}