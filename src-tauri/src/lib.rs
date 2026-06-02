use std::sync::Arc;

use futures::lock::Mutex;
use tauri::Manager;

mod commands;
mod database;
mod engine;

use crate::commands::video;
use crate::database::connection;

struct AppState {
    engine: Arc<Mutex<Option<engine::engine::ClipEngine>>>,
}

impl AppState {
    fn new() -> Self {
        AppState {
            engine: Arc::new(Mutex::new(None)),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_drag::init())
        .manage(AppState::new())
        .setup(|app| {
            let db_path = app.path().app_data_dir().unwrap().join(".db");

            let handle_clone = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                let connection = connection::init(db_path.to_str().unwrap())
                    .await
                    .expect("Failed to initialize database connection");
                handle_clone.manage(connection.clone());
            });

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let app_state_clone = handle.state::<AppState>();
                let mut engine_lock = app_state_clone.engine.lock().await;
                *engine_lock = Some(engine::engine::ClipEngine::new());
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            video::get_videos,
            video::search_frames,
            video::index_video,
            video::get_frame_image,
            video::delete_video,
            video::reindex_video,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
