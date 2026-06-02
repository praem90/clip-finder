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
pub struct PaginatedResponse {
    success: bool,
    results: Vec<Video>,
    page: usize,
    page_size: usize,
    total: usize,
    total_pages: usize,
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
pub async fn get_videos(
    page: Option<usize>,
    page_size: Option<usize>,
    connection: State<'_, Connection>,
) -> Result<PaginatedResponse, String> {
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(15).clamp(1, 100);
    let offset = (page - 1) * page_size;

    let (videos, total) = operations::get_videos(&connection, page_size, offset).await?;
    let total_pages = total.div_ceil(page_size).max(1);

    let response = PaginatedResponse {
        success: true,
        results: videos,
        page,
        page_size,
        total,
        total_pages,
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
    let engine_lock = app_state.engine.lock().await;
    let engine = engine_lock.as_ref().ok_or("Engine not loaded yet")?;
    engine::index::index_video(&connection, &engine, &video)
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
pub async fn get_tags(connection: State<'_, Connection>) -> Result<Vec<String>, String> {
    operations::get_all_tags(&connection).await
}

#[tauri::command]
pub async fn update_video_tags(
    video_id: String,
    tags: Vec<String>,
    connection: State<'_, Connection>,
) -> Result<Response, String> {
    let video = operations::update_video_tags(&connection, video_id, tags).await?;

    Ok(Response {
        success: true,
        results: vec![video],
        error: None,
    })
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
        let engine_lock = app_state.engine.lock().await;
        let engine = engine_lock.as_ref().ok_or("Engine not loaded yet")?;
        engine::index::index_video(&connection, &engine, &video)
            .await
            .unwrap();
    } else {
        return Err("Video not found".to_string());
    }

    return Ok(());
}
