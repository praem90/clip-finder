use std::sync::atomic::{AtomicBool, Ordering};
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
    engine_ready: Arc<AtomicBool>,
}

impl AppState {
    fn new() -> Self {
        AppState {
            engine: Arc::new(Mutex::new(None)),
            engine_ready: Arc::new(AtomicBool::new(false)),
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
                match engine::engine::ClipEngine::new() {
                    Ok(clip_engine) => {
                        {
                            let mut engine_lock = app_state_clone.engine.lock().await;
                            *engine_lock = Some(clip_engine);
                        }
                        app_state_clone.engine_ready.store(true, Ordering::SeqCst);
                        println!("✅ CLIP engine ready");
                    }
                    Err(e) => {
                        eprintln!("❌ Failed to load CLIP engine: {}", e);
                    }
                }
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
            video::is_engine_ready,
            video::export_clip,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
