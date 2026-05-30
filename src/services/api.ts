import axios from "axios";
import { ApiResponse } from "@/types/api";
import { Video } from "@/types/video";
import { SearchResult } from "../types/video";
import { invoke } from '@tauri-apps/api/core';


const apiClient = axios.create({
	baseURL: "http://localhost:58000",
	headers: {
		"Content-Type": "application/json",
	},
});

export const getVideos = async (): Promise<ApiResponse<Video[]>> => {
	return invoke("get_videos").then(r => {
		console.log("Videos:", r);
		return r as ApiResponse<Video[]>;
	});
	// return apiClient.get<ApiResponse<Video[]>>("/videos").then((response) => response.data);
};

export const indexVideo = async (params: { path: string }): Promise<ApiResponse<Video>> => {
	return apiClient.post<ApiResponse<Video>>("/index", params).then((response) => response.data);
}

export const searchVideos = async (params: { query: string }): Promise<ApiResponse<SearchResult[]>> => {
	invoke("search_frames", { query: params.query }).then(r => {
		console.log("Search results:", r);
	});
	return apiClient.get<ApiResponse<SearchResult[]>>("/search", { params }).then((response) => response.data);
};

export const deleteVideo = async (videoId: string) => {
	return apiClient.delete(`/videos/${videoId}`).then((response) => response.data);
};

export const reIndexVideo = async (videoId: string) => {
	return apiClient.post(`/index/${videoId}`).then((response) => response.data);
};
