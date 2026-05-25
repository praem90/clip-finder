export interface Video {
	id: string;
	name: string;
	path: string;
	status: Status;
	lastIndexedAt: string;
}

export enum Status {
	PENDING = "pending",
	PROCESSING = "processing",
	COMPLETED = "completed",
	FAILED = "failed",
}

export interface SearchResult {
	id: string;
	video_id: string;
	timestamp: number;
	video: Video;
	_distance?: number; // Optional field for search result relevance scoring
}

