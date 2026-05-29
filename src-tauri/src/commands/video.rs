use crate::database::connection::Connection;
use crate::database::models::Video;
use crate::database::operations;
use tauri::State;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Response {
    success: bool,
    results: Vec<Video>,
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
