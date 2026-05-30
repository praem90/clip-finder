use candle_transformers::models::clip::ClipModel;
use lancedb::Connection;
use std::fs;
use std::process::Command;
use tempfile::Builder;

use crate::database::models::{Frame, Video};
use crate::database::{self, operations};
use crate::engine::clip;

pub fn extract_frames(video_path: &str) -> Result<tempfile::TempDir, String> {
    let temp_dir = Builder::new()
        .prefix("clipfinder_")
        .tempdir()
        .map_err(|e| e.to_string())?;
    let output_pattern = temp_dir.path().join("frame_%04d.jpg");
    println!(
        "Extracting frames to temporary directory: {:?}",
        temp_dir.path()
    );

    let status = Command::new("ffmpeg")
        .arg("-i")
        .arg(video_path)
        .arg("-vf")
        .arg("fps=1") // Extract 1 frame per second
        .arg("-q:v")
        .arg("2") // High-quality JPEG
        .arg(output_pattern.to_str().unwrap())
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("error") // Only print actual crashes
        .status()
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;

    if !status.success() {
        return Err("FFmpeg failed to extract frames".to_string());
    } else {
        println!("Frames extracted successfully.");
    }

    Ok(temp_dir)
}

// You will need the `image` crate in your Cargo.toml for this
pub async fn index_video(
    connection: &Connection,
    model: &ClipModel,
    video: &Video,
) -> Result<(), String> {
    println!("Extracting frames from {}", video.path);
    if video.status != "processing" {
        operations::update_video_status(connection, video.id.clone(), "processing".to_string())
            .await?;
    }
    let temp_dir = extract_frames(video.path.as_str()).unwrap();

    // Read the directory
    let mut entries = fs::read_dir(temp_dir.path())
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();

    // Sort alphabetically so frame_0001 comes before frame_0002
    entries.sort_by_key(|e| e.path());

    for (index, entry) in entries.iter().enumerate() {
        let image_path = entry.path();

        let timestamp_seconds = index;

        let embeddings = clip::get_image_embedding(&model, image_path.to_str().as_ref().unwrap())
            .map_err(|e| format!("Failed to get image embedding: {}", e))?;

        let frame = Frame {
            video_id: video.id.clone(),
            timestamp: timestamp_seconds as f64,
            vector: Some(embeddings),
            confidence: None,
        };

        database::operations::create_frames(connection, frame).await;
    }
    println!("Indexed {} frames for video {}", entries.len(), video.name);
    operations::update_video_status(connection, video.id.clone(), "completed".to_string()).await?;

    // When the function ends, `temp_dir` goes out of scope and the OS deletes all the JPEGs automatically!
    Ok(())
}
