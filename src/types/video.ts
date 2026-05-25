export interface Video {
	id: string;
	name: string;
	path: string;
	status: Status;
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
}

