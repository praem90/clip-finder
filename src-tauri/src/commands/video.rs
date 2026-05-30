use crate::database::connection::Connection;
use crate::database::models::{Frame, Video};
use crate::database::operations;
use crate::engine;
use chrono::Utc;
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
    app_state: State<'_, crate::AppState>,
) -> Result<FrameResponse, String> {
    let model_lock = app_state.model.lock().await;
    let model = model_lock.as_ref().ok_or("Model not loaded yet")?;

    let tokenizer_lock = app_state.tokenizer.lock().await;
    let tokenizer = tokenizer_lock.as_ref().ok_or("Tokenizer not loaded yet")?;

    let result = operations::search_frames(&connection, &model, &tokenizer, query).await?;

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

#[tauri::command]
pub async fn index_video(
    path: String,
    connection: State<'_, Connection>,
    app_state: State<'_, crate::AppState>,
) -> Result<Response, String> {
    let video = Video {
        id: uuid::Uuid::new_v4().to_string(),
        path: path.to_string(),
        name: path
            .split('/')
            .last()
            .unwrap_or("unknown_video")
            .to_string(),
        tags: vec![],
        status: "pending".to_string(),
        created_at: Some(Utc::now()),
        last_indexed_at: Some(Utc::now()),
    };
    let video = operations::create_video(&connection, video).await.unwrap();
    let model_lock = app_state.model.lock().await;
    let model = model_lock.as_ref().ok_or("Model not loaded yet")?;
    engine::index::index_video(&connection, &model, &video)
        .await
        .unwrap();

    let res = Response {
        success: true,
        results: vec![],
        error: None,
    };

    return Ok(res);
}

#[tauri::command]
pub async fn get_frame_image(
    video_path: String,
    timestamp: f64,
) -> Result<tauri::ipc::Response, String> {
    let temp_dir = std::env::temp_dir();
    // TODO: sanitize video name to prevent path traversal
    let frame_filename = format!(
        "{}_{}.jpg",
        video_path.split('/').last().unwrap_or("unknown_video"),
        timestamp as u64
    );
    let frame_path = temp_dir.join(frame_filename);
    if !frame_path.exists() {
        engine::index::extract_single_frame(
            video_path.as_str(),
            timestamp,
            frame_path.to_str().unwrap(),
        )
        .await
        .map_err(|e| format!("Failed to extract frame: {}", e))
        .unwrap();
    }

    let data = std::fs::read(frame_path).map_err(|e| format!("Failed to read frame image: {}", e));
    Ok(tauri::ipc::Response::new(data.unwrap()))
}

#[tauri::command]
pub async fn delete_video(
    video_id: String,
    connection: State<'_, Connection>,
) -> Result<(), String> {
    operations::delete_video(&connection, video_id)
        .await
        .unwrap();

    return Ok(());
}

#[tauri::command]
pub async fn reindex_video(
    video_id: String,
    connection: State<'_, Connection>,
    app_state: State<'_, crate::AppState>,
) -> Result<(), String> {
    operations::delete_frames_by_video_id(&connection, video_id.clone())
        .await
        .unwrap();
    let video = operations::get_video_by_id(&connection, video_id.clone())
        .await
        .unwrap();
    if let Some(video) = video {
        let model_lock = app_state.model.lock().await;
        let model = model_lock.as_ref().ok_or("Model not loaded yet")?;
        engine::index::index_video(&connection, &model, &video)
            .await
            .unwrap();
    } else {
        return Err("Video not found".to_string());
    }

    return Ok(());
}
