use lancedb::Connection;
use std::io::Read;
use std::path::PathBuf;
use std::process::{Command, Stdio};

use crate::database;
use crate::database::models::{Frame, Video};
use crate::engine::engine::ClipEngine;

/// Per-frame indexing progress reported back to the caller. The engine layer
/// is transport-agnostic; the command layer decides how to surface this
/// (currently an `index-progress` Tauri event).
#[derive(Clone, serde::Serialize)]
pub struct IndexProgress {
    video_id: String,
    processed: u64,
    total: u64,
}

pub async fn extract_single_frame(
    video_path: &str,
    timestamp_seconds: f64,
    output_path: &str,
) -> Result<(), String> {
    let ffmpeg_path = get_ffmpeg_path();
    let status = Command::new(ffmpeg_path)
        .arg("-ss")
        .arg(timestamp_seconds.to_string())
        .arg("-i")
        .arg(video_path)
        .arg("-vframes")
        .arg("1")
        .arg("-y")
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("error")
        .arg(output_path)
        .status()
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;

    if !status.success() {
        return Err("FFmpeg failed to extract the requested frame".to_string());
    }

    Ok(())
}

// You will need the `image` crate in your Cargo.toml for this
pub async fn index_video(
    connection: &Connection,
    engine: &ClipEngine,
    video: &Video,
    on_progress: impl Fn(IndexProgress) + Send,
) -> Result<(), String> {
    println!("Extracting frames from {}", video.path);
    if video.status != "processing" {
        database::operations::update_video_status(
            connection,
            video.id.clone(),
            "processing".to_string(),
        )
        .await?;
    }
    let width = 224; // CLIP's required width
    let height = 224; // CLIP's required height

    // Frames are sampled at 1 fps, so the total frame count ≈ the duration in
    // seconds. Probe it once so the UI can show a real progress percentage.
    let total = probe_duration_seconds(video.path.as_str())
        .map(|d| d.ceil() as u64)
        .unwrap_or(0);

    let ffmpeg_path = get_ffmpeg_path();
    let mut child = Command::new(ffmpeg_path)
        .arg("-i")
        .arg(video.path.as_str())
        // Extract 1 frame per second and scale it on the fly
        .arg("-vf")
        .arg(format!("fps=1,scale={}:{}", width, height))
        // Force output to be raw, uncompressed bytes (no JPEG overhead)
        .arg("-f")
        .arg("image2pipe")
        .arg("-pix_fmt")
        .arg("rgb24")
        .arg("-vcodec")
        .arg("rawvideo")
        // Stream directly to stdout instead of a file
        .arg("-")
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("error")
        .stdout(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start FFmpeg: {}", e))?;

    let mut stdout = child
        .stdout
        .take()
        .ok_or("Failed to capture FFmpeg output")?;

    let mut buffer = vec![0; (width * height * 3) as usize]; // RGB24 means 3 bytes per pixel
    let mut frame_count = 0;

    loop {
        match stdout.read_exact(&mut buffer) {
            Ok(_) => {
                let embeddings = engine
                    .get_image_embedding(buffer.clone())
                    .map_err(|e| format!("Failed to get image embedding: {}", e))?;
                let frame = Frame {
                    video_id: video.id.clone(),
                    timestamp: frame_count as f64,
                    vector: Some(embeddings),
                    confidence: None,
                };

                database::operations::create_frames(connection, frame).await?;
                frame_count += 1;
                println!("Indexed frame {}", frame_count);
                on_progress(IndexProgress {
                    video_id: video.id.clone(),
                    processed: frame_count as u64,
                    total,
                });
            }
            Err(e) => {
                if e.kind() == std::io::ErrorKind::UnexpectedEof {
                    break; // End of stream, we're done
                } else {
                    return Err(format!("Error reading FFmpeg output: {}", e));
                }
            }
        }
    }
    drop(stdout);
    let status = child
        .wait()
        .map_err(|e| format!("Failed to wait for FFmpeg: {}", e))?;
    if !status.success() {
        return Err("FFmpeg failed while streaming frames".to_string());
    }

    println!("Indexed {} frames for video {}", frame_count, video.name);
    database::operations::update_video_status(
        connection,
        video.id.clone(),
        "completed".to_string(),
    )
    .await?;

    // When the function ends, `temp_dir` goes out of scope and the OS deletes all the JPEGs automatically!
    Ok(())
}

fn get_ffmpeg_path() -> PathBuf {
    let current_exe_result = std::env::current_exe();

    if current_exe_result.is_err() {
        // If we can't get the current executable path, fall back to just "ffmpeg" and hope it's in the PATH
        return PathBuf::from("ffmpeg");
    }

    let mut path = current_exe_result.unwrap();

    path.pop(); // Remove the executable name

    #[cfg(target_os = "windows")]
    path.push("ffmpeg.exe");

    #[cfg(not(target_os = "windows"))]
    path.push("ffmpeg");

    return path;
}

/// Probe a video's duration (seconds) by parsing the `Duration:` line ffmpeg
/// prints to stderr. Returns None if it can't be determined.
fn probe_duration_seconds(video_path: &str) -> Option<f64> {
    let ffmpeg_path = get_ffmpeg_path();
    let output = Command::new(ffmpeg_path)
        .arg("-i")
        .arg(video_path)
        .arg("-hide_banner")
        .output()
        .ok()?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    let idx = stderr.find("Duration:")?;
    let after = &stderr[idx + "Duration:".len()..];
    let dur = after.split(',').next()?.trim(); // e.g. "00:04:12.34"
    let parts: Vec<&str> = dur.split(':').collect();
    if parts.len() != 3 {
        return None;
    }
    let h: f64 = parts[0].trim().parse().ok()?;
    let m: f64 = parts[1].trim().parse().ok()?;
    let s: f64 = parts[2].trim().parse().ok()?;
    Some(h * 3600.0 + m * 60.0 + s)
}

/// Cut a `duration_seconds`-long clip starting at `start_seconds` into `output_path`.
/// Uses stream copy (fast; clamps to the nearest keyframe).
pub async fn export_clip(
    video_path: &str,
    start_seconds: f64,
    duration_seconds: f64,
    output_path: &str,
) -> Result<(), String> {
    if duration_seconds <= 0.0 {
        return Err("Invalid clip duration".to_string());
    }
    let ffmpeg_path = get_ffmpeg_path();
    let status = Command::new(ffmpeg_path)
        // Fast seek before -i, then a fixed duration with -t.
        .arg("-ss")
        .arg(start_seconds.to_string())
        .arg("-i")
        .arg(video_path)
        .arg("-t")
        .arg(duration_seconds.to_string())
        .arg("-c")
        .arg("copy")
        .arg("-avoid_negative_ts")
        .arg("make_zero")
        .arg("-y")
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("error")
        .arg(output_path)
        .status()
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;

    if !status.success() {
        return Err("FFmpeg failed to export the clip".to_string());
    }

    Ok(())
}
