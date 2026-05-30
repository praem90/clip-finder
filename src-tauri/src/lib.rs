use candle_core::Device;
use candle_transformers::models::clip::ClipModel;
use futures::lock::Mutex;
use tauri::Manager;

use tokenizers::tokenizer::Tokenizer;

mod commands;
mod database;
mod engine;

use crate::commands::video;
use crate::database::connection;

struct AppState {
    model: Mutex<Option<ClipModel>>,
    tokenizer: Mutex<Option<Tokenizer>>,
    device: Device,
}

impl AppState {
    fn new() -> Self {
        AppState {
            model: Mutex::new(None),
            tokenizer: Mutex::new(None),
            device: engine::clip::get_best_device().unwrap().clone(),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
                let (model, tokenizer) = engine::clip::get_model(&app_state_clone.device);

                let mut model_lock = app_state_clone.model.lock().await;
                *model_lock = Some(model);

                let mut tokenizer_lock = app_state_clone.tokenizer.lock().await;
                *tokenizer_lock = Some(tokenizer);
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
