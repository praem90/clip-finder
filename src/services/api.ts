import axios from "axios";
import { ApiResponse } from "@/types/api";
import { Video } from "@/types/video";
import { SearchResult } from "../types/video";

const apiClient = axios.create({
	baseURL: "http://localhost:8000",
	headers: {
		"Content-Type": "application/json",
	},
});

export const getVideos = async (): Promise<ApiResponse<Video[]>> => {
	return apiClient.get<ApiResponse<Video[]>>("/videos").then((response) => response.data);
};

export const indexVideo = async ({ videoPath }): Promise<ApiResponse<Video>> => {
	return apiClient.post<ApiResponse<Video>>("/index", { path: videoPath }).then((response) => response.data);
}

export const searchVideos = async ({ query }): Promise<ApiResponse<Video[]>> => {
	return apiClient.get<ApiResponse<SearchResult[]>>("/search", { params: { query } }).then((response) => response.data);
};

export const deleteVideo = async (videoId: string) => {
	return apiClient.delete(`/videos/${videoId}`).then((response) => response.data);
};

export const reIndexVideo = async (videoId: string) => {
	return apiClient.post(`/index/${videoId}`).then((response) => response.data);
};
