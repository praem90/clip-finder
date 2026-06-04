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
    let engine_lock = app_state.engine.lock().await;
    let engine = engine_lock.as_ref().ok_or("Model not loaded yet")?;

    let embeddings = engine
        .get_text_embedding(query.clone())
        .map_err(|e| format!("Failed to get text embedding: {}", e))?;

    let result = operations::search_frames(&connection, &embeddings).await?;

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
    app_handle: tauri::AppHandle,
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
    let video = operations::create_video(&connection, video).await?;
    let engine_lock = app_state.engine.lock().await;
    let engine = engine_lock.as_ref().ok_or("Engine not loaded yet")?;
    if let Err(e) = engine::index::index_video(&connection, &engine, &video, &app_handle).await {
        let _ =
            operations::update_video_status(&connection, video.id.clone(), "failed".to_string())
                .await;
        return Err(e);
    }

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
    // Only ever read frames from a real, existing file on disk.
    if !std::path::Path::new(&video_path).is_file() {
        return Err("Video file not found".to_string());
    }

    let temp_dir = std::env::temp_dir();
    // The output file is always written inside temp_dir using only the basename,
    // so a crafted video_path cannot escape the temp directory.
    let frame_filename = format!(
        "{}_{}.jpg",
        video_path.split('/').last().unwrap_or("unknown_video"),
        timestamp as u64
    );
    let frame_path = temp_dir.join(frame_filename);
    if !frame_path.exists() {
        let output = frame_path
            .to_str()
            .ok_or("Invalid temporary frame path")?;
        engine::index::extract_single_frame(video_path.as_str(), timestamp, output)
            .await
            .map_err(|e| format!("Failed to extract frame: {}", e))?;
    }

    let data =
        std::fs::read(&frame_path).map_err(|e| format!("Failed to read frame image: {}", e))?;
    Ok(tauri::ipc::Response::new(data))
}

#[tauri::command]
pub async fn delete_video(
    video_id: String,
    connection: State<'_, Connection>,
) -> Result<(), String> {
    validate_video_id(&video_id)?;
    operations::delete_video(&connection, video_id).await?;

    return Ok(());
}

#[tauri::command]
pub async fn reindex_video(
    video_id: String,
    connection: State<'_, Connection>,
    app_state: State<'_, crate::AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    validate_video_id(&video_id)?;
    operations::delete_frames_by_video_id(&connection, video_id.clone()).await?;
    let video = operations::get_video_by_id(&connection, video_id.clone()).await?;
    if let Some(video) = video {
        let engine_lock = app_state.engine.lock().await;
        let engine = engine_lock.as_ref().ok_or("Engine not loaded yet")?;
        if let Err(e) = engine::index::index_video(&connection, &engine, &video, &app_handle).await {
            let _ = operations::update_video_status(
                &connection,
                video.id.clone(),
                "failed".to_string(),
            )
            .await;
            return Err(e);
        }
    } else {
        return Err("Video not found".to_string());
    }

    return Ok(());
}

#[tauri::command]
pub async fn is_engine_ready(app_state: State<'_, crate::AppState>) -> Result<bool, String> {
    Ok(app_state
        .engine_ready
        .load(std::sync::atomic::Ordering::SeqCst))
}

/// Export a clip spanning `before_secs` before and `after_secs` after `timestamp`
/// (clamped at the start of the file) to `output_path`.
#[tauri::command]
pub async fn export_clip(
    video_path: String,
    timestamp: f64,
    before_secs: f64,
    after_secs: f64,
    output_path: String,
) -> Result<(), String> {
    if !std::path::Path::new(&video_path).is_file() {
        return Err("Video file not found".to_string());
    }
    let start = (timestamp - before_secs).max(0.0);
    let duration = (timestamp + after_secs) - start;
    engine::index::export_clip(&video_path, start, duration, &output_path).await
}

/// Guard against SQL-literal injection: every id we store is a v4 UUID, so reject
/// anything that isn't one before it reaches an `only_if` / `delete` clause.
fn validate_video_id(video_id: &str) -> Result<(), String> {
    uuid::Uuid::parse_str(video_id)
        .map(|_| ())
        .map_err(|_| "Invalid video id".to_string())
}
