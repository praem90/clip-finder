use lancedb::Connection;
use std::fs;
use std::process::Command;
use tempfile::Builder;

use crate::database;
use crate::database::models::{Frame, Video};
use crate::engine::engine::ClipEngine;

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

pub async fn extract_single_frame(
    video_path: &str,
    timestamp_seconds: f64,
    output_path: &str,
) -> Result<(), String> {
    let status = Command::new("ffmpeg")
        // 1. CRITICAL: -ss BEFORE -i makes the seek instantaneous
        .arg("-ss")
        .arg(timestamp_seconds.to_string())
        // 2. Specify the input video
        .arg("-i")
        .arg(video_path)
        // 3. Tell FFmpeg to stop after grabbing exactly 1 frame
        .arg("-vframes")
        .arg("1")
        // 4. Set high JPEG quality (2 is excellent, 31 is worst)
        // .arg("-q:v")
        // .arg("2")
        // 5. Overwrite the output file if it already exists
        .arg("-y")
        // 6. Suppress unnecessary terminal output
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("error")
        // 7. Define the target destination
        .arg(output_path)
        // Execute the process
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

        let embeddings = engine
            .get_image_embedding(image_path.to_str().as_ref().unwrap())
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
    database::operations::update_video_status(
        connection,
        video.id.clone(),
        "completed".to_string(),
    )
    .await?;

    // When the function ends, `temp_dir` goes out of scope and the OS deletes all the JPEGs automatically!
    Ok(())
}
