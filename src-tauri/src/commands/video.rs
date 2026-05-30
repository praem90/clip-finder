use crate::database::connection::Connection;
use crate::database::models::{Frame, Video};
use crate::database::operations;
use tauri::State;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Response {
    success: bool,
    results: Vec<Video>,
    error: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FrameResult {
    video: Video,
    frame: Frame,
    confidence: Option<f32>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FrameResponse {
    success: bool,
    results: Vec<FrameResult>,
    error: Option<String>,
}

#[tauri::command]
pub async fn get_videos(connection: State<'_, Connection>) -> Result<Response, String> {
    let videos = operations::get_videos(&connection).await?;

    let response = Response {
        success: true,
        results: videos,
        error: None,
    };

    Ok(response)
}

#[tauri::command]
pub async fn search_frames(
    query: String,
    connection: State<'_, Connection>,
) -> Result<FrameResponse, String> {
    let result = operations::search_frames(&connection, query).await?;

    let response = FrameResponse {
        success: true,
        results: result
            .iter()
            .map(|(frame, video)| FrameResult {
                video: video.clone(),
                frame: frame.clone(),
                confidence: frame.confidence,
            })
            .collect(),
        error: None,
    };

    Ok(response)
}
