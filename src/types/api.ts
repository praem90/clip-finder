export interface ApiResponse<T> {
	results: T;
}

export interface PaginatedResponse<T> {
	results: T;
	page: number;
	page_size: number;
	total: number;
	total_pages: number;
}
