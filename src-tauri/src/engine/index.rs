use lancedb::Connection;
use std::io::Read;
use std::process::{Command, Stdio};

use crate::database;
use crate::database::models::{Frame, Video};
use crate::engine::engine::ClipEngine;

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
    let width = 224; // CLIP's required width
    let height = 224; // CLIP's required height

    let mut child = Command::new("ffmpeg")
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

                database::operations::create_frames(connection, frame).await;
                println!("Indexed frame {}", frame_count);
                frame_count += 1;
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
