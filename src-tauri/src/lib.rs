use futures::lock::Mutex;
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};

mod commands;
mod database;

use crate::commands::video::get_videos;
use crate::database::connection;
use crate::database::connection::Connection;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

struct AppState {
    db: Mutex<Option<Connection>>,
    engine_process: Mutex<Option<CommandChild>>,
}

impl AppState {
    fn new() -> Self {
        AppState {
            db: Mutex::new(None),
            engine_process: Mutex::new(None),
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

                let state = handle.state::<AppState>();
                let mut engine_process = state.engine_process.lock().await;
                *engine_process = Some(_child);

                while let Some(event) = _rx.recv().await {
                    if let CommandEvent::Stdout(line) = &event {
                        let line_str = String::from_utf8(line.clone()).unwrap();
                        if line_str.contains("Application startup complete") {
                            println!("Engine is ready!");
                            handle.emit("engine_ready", {}).unwrap();
                        }
                        println!("Received stdout: {}", line_str);
                    }

                    if let CommandEvent::Stderr(line) = &event {
                        let line_str = String::from_utf8(line.clone()).unwrap();
                        if line_str.contains("Application startup complete") {
                            println!("Engine is ready!");
                            handle.emit("engine_ready", {}).unwrap();
                        }
                        println!(
                            "Received stderr: {}",
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

            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async {
                let connection = connection::init(db_path.to_str().unwrap())
                    .await
                    .expect("Failed to initialize database connection");
                handle.manage(connection.clone());
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let app_handle = window.app_handle().clone();
                tauri::async_runtime::spawn(async move {
                    let state = app_handle.state::<AppState>();
                    let mut engine_process = state.engine_process.lock().await;
                    if let Some(child) = engine_process.take() {
                        println!("We got the process and Killing it... {}", child.pid());
                        child.kill().expect("Failed to kill the process");
                    }
                });
            }
        })
        .invoke_handler(tauri::generate_handler![greet])
        .invoke_handler(tauri::generate_handler![get_videos])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
