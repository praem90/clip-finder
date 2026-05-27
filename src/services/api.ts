import axios from "axios";
import { ApiResponse } from "@/types/api";
import { Video } from "@/types/video";
import { SearchResult } from "../types/video";

const apiClient = axios.create({
	baseURL: "http://localhost:58000",
	headers: {
		"Content-Type": "application/json",
	},
});

export const getVideos = async (): Promise<ApiResponse<Video[]>> => {
	return apiClient.get<ApiResponse<Video[]>>("/videos").then((response) => response.data);
};

export const indexVideo = async (params: { path: string }): Promise<ApiResponse<Video>> => {
	return apiClient.post<ApiResponse<Video>>("/index", params).then((response) => response.data);
}

export const searchVideos = async (params: { query: string }): Promise<ApiResponse<SearchResult[]>> => {
	return apiClient.get<ApiResponse<SearchResult[]>>("/search", { params }).then((response) => response.data);
};

export const deleteVideo = async (videoId: string) => {
	return apiClient.delete(`/videos/${videoId}`).then((response) => response.data);
};

export const reIndexVideo = async (videoId: string) => {
	return apiClient.post(`/index/${videoId}`).then((response) => response.data);
};
