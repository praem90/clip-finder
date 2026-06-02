import { ApiResponse, PaginatedResponse } from "@/types/api";
import { Video, SearchResult } from "@/types/video";
import { invoke } from '@tauri-apps/api/core';

export const getVideos = async (
  params?: { page?: number; pageSize?: number }
): Promise<PaginatedResponse<Video[]>> => {
  return invoke<PaginatedResponse<Video[]>>("get_videos", {
    page: params?.page ?? 1,
    pageSize: params?.pageSize ?? 15,
  });
};

export const indexVideo = async (params: { path: string }): Promise<void> => {
  return invoke("index_video", params);
}

export const searchVideos = async (params: { query: string }): Promise<ApiResponse<SearchResult[]>> => {
  return invoke<ApiResponse<{ frame: SearchResult, video: Video }[]>>("search_frames", { query: params.query }).then((response) => {
    const res = { results: [] } as ApiResponse<SearchResult[]>;
    res.results = response.results.map(result => {
      return { ...result.frame, video: result.video };
    });

    return res as ApiResponse<SearchResult[]>;
  });
};

export const deleteVideo = async (videoId: string): Promise<void> => {
  return invoke("delete_video", { videoId });
};

export const reIndexVideo = async (videoId: string): Promise<void> => {
  return invoke("reindex_video", { videoId });
};

export const updateVideoTags = async (videoId: string, tags: string[]): Promise<void> => {
  return invoke("update_video_tags", { videoId, tags });
};

export const getTags = async (): Promise<string[]> => {
  return invoke<string[]>("get_tags");
};

export const getFrameThumbnail = async (videoPath: string, timestamp: number): Promise<ArrayBuffer> => {
  return invoke("get_frame_image", { videoPath, timestamp });
}
