import { ApiResponse } from "@/types/api";
import { Video, SearchResult } from "@/types/video";
import { invoke } from '@tauri-apps/api/core';

export const getVideos = async (): Promise<ApiResponse<Video[]>> => {
  return invoke<ApiResponse<Video[]>>("get_videos");
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

export const getFrameThumbnail = async (videoPath: string, timestamp: number): Promise<ArrayBuffer> => {
  return invoke("get_frame_image", { videoPath, timestamp });
}
