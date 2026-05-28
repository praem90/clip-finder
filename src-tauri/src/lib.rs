use lancedb::Connection;
use tauri::Manager;
use tauri_plugin_shell::{process::CommandEvent, ShellExt};

mod database;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

struct AppState {
    db: Connection,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_drag::init())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let api_path = handle
                    .path()
                    .resource_dir()
                    .unwrap()
                    .join("engine")
                    .join("engine");

                println!("API Path: {:?}", api_path);

                let (mut _rx, _child) = handle
                    .shell()
                    .command(api_path.to_str().unwrap())
                    .spawn()
                    .expect("Failed to spawn the process");

                while let Some(event) = _rx.recv().await {
                    if let CommandEvent::Stdout(line) = &event {
                        println!(
                            "Received stdout: {}",
                            String::from_utf8(line.clone()).unwrap()
                        );
                    }
                }
            });

            let db_path = app
                .path()
                .resource_dir()
                .unwrap()
                .join("engine")
                .join("lib")
                .join(".db");

            let db = tauri::async_runtime::block_on(async {
                let db = lancedb::connect(db_path.to_str().unwrap())
                    .execute()
                    .await
                    .unwrap();

                database::create_tables(&db).await.unwrap();

                return db;
            });

            app.manage(AppState { db });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .invoke_handler(tauri::generate_handler![database::get_videos])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
