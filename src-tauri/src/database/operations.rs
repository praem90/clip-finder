use arrow_array::types::{Float32Type, TimestampMicrosecondType};
use arrow_array::{
    Array, Float32Array, Float64Array, ListArray, PrimitiveArray, RecordBatch, StringArray,
};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use lancedb::query::{ExecutableQuery, QueryBase};
use lancedb::Connection;

use crate::database::models::{Frame, Video};
use crate::engine::clip;

pub async fn get_videos(connection: &Connection) -> Result<Vec<Video>, String> {
    let table = connection.open_table("videos").execute().await.unwrap();
    let batches = table
        .query()
        .limit(100)
        .execute()
        .await
        .unwrap()
        .try_collect::<Vec<_>>()
        .await
        .unwrap();

    let videos = batches
        .iter()
        .map(|batch| convert_record_batch_to_videos(batch))
        .flatten()
        .collect::<Vec<Video>>();

    Ok(videos)
}

pub async fn search_frames(
    connection: &Connection,
    query: String,
) -> Result<Vec<(Frame, Video)>, String> {
    let frames_table = connection.open_table("frames").execute().await.unwrap();
    let query_embedding = clip::get_text_embedding(query).unwrap();
    let frames_batches = frames_table
        .query()
        .nearest_to(query_embedding)
        .unwrap()
        .distance_type(lancedb::DistanceType::Cosine)
        // .distance_range(None, Some(0.75))
        .select(lancedb::query::Select::Columns(vec![
            "video_id".to_string(),
            "timestamp".to_string(),
            "_distance".to_string(),
        ]))
        .limit(100)
        .execute()
        .await
        .unwrap()
        .try_collect::<Vec<_>>()
        .await
        .unwrap();

    if frames_batches.is_empty() {
        return Ok(vec![]);
    }

    let video_ids = frames_batches
        .iter()
        .map(|batch| {
            let video_id_col = batch
                .column_by_name("video_id")
                .unwrap()
                .as_any()
                .downcast_ref::<StringArray>()
                .expect("Failed to downcast 'video_id' column");

            (0..batch.num_rows())
                .map(|i| format!("'{}'", video_id_col.value(i).to_string()))
                .collect::<Vec<String>>()
        })
        .flatten()
        .collect::<Vec<String>>();

    let frames = frames_batches
        .iter()
        .map(|batch| {
            let video_id_col = batch
                .column_by_name("video_id")
                .unwrap()
                .as_any()
                .downcast_ref::<StringArray>()
                .expect("Failed to downcast 'video_id' column");

            let timestamp_col = batch
                .column_by_name("timestamp")
                .unwrap()
                .as_any()
                .downcast_ref::<Float64Array>()
                .expect("Failed to downcast 'timestamp' column");

            let distance_col = batch
                .column_by_name("_distance")
                .unwrap()
                .as_any()
                .downcast_ref::<Float32Array>()
                .expect("Failed to downcast '_distance' column");

            (0..batch.num_rows())
                .map(|i| Frame {
                    video_id: video_id_col.value(i).to_string(),
                    timestamp: timestamp_col.value(i),
                    vector: None,
                    confidence: Some(1.0 - distance_col.value(i) as f32), // Convert distance to confidence
                })
                .collect::<Vec<Frame>>()
        })
        .flatten()
        .collect::<Vec<Frame>>();

    let videos_table = connection.open_table("videos").execute().await.unwrap();
    let videos_batches = videos_table
        .query()
        .only_if(format!("id IN ({})", video_ids.join(",")))
        .execute()
        .await
        .unwrap()
        .try_collect::<Vec<_>>()
        .await
        .unwrap();

    let videos = videos_batches
        .iter()
        .map(|batch| convert_record_batch_to_videos(batch))
        .flatten()
        .collect::<Vec<Video>>();

    let mut results = vec![];

    for frame in frames {
        if let Some(video) = videos.iter().find(|v| v.id == frame.video_id) {
            results.push((frame.clone(), video.clone()));
        }
    }

    return Ok(results);
}

fn convert_record_batch_to_videos(batch: &RecordBatch) -> Vec<Video> {
    let id_col = batch
        .column_by_name("id")
        .unwrap()
        .as_any()
        .downcast_ref::<StringArray>()
        .expect("Failed to downcast 'id' column");
    let path_col = batch
        .column_by_name("path")
        .unwrap()
        .as_any()
        .downcast_ref::<StringArray>()
        .expect("Failed to downcast 'path' column");

    let name_col = batch
        .column_by_name("name")
        .unwrap()
        .as_any()
        .downcast_ref::<StringArray>()
        .expect("Failed to downcast 'name' column");
    let status_col = batch
        .column_by_name("status")
        .unwrap()
        .as_any()
        .downcast_ref::<StringArray>()
        .expect("Failed to downcast 'status' column");

    let tags_col = batch
        .column_by_name("tags")
        .unwrap()
        .as_any()
        .downcast_ref::<ListArray>()
        .unwrap();

    let last_indexed_at_col = batch
        .column_by_name("lastIndexedAt")
        .unwrap()
        .as_any()
        .downcast_ref::<PrimitiveArray<TimestampMicrosecondType>>()
        .unwrap();

    let mut videos = vec![];

    for i in 0..batch.num_rows() {
        let list_array = tags_col.value(i);
        let string_array = list_array
            .as_any()
            .downcast_ref::<StringArray>()
            .expect("Failed to downcast list array to StringArray");
        let tags = string_array
            .iter()
            .map(|j| j.unwrap().to_string())
            .collect::<Vec<String>>();

        let last_indexed_at = if last_indexed_at_col.is_null(i) {
            None
        } else {
            let timestamp = last_indexed_at_col.value(i);
            DateTime::<Utc>::from_timestamp_micros(timestamp)
        };

        videos.push(Video {
            id: id_col.value(i).to_string(),
            path: path_col.value(i).to_string(),
            name: name_col.value(i).to_string(),
            status: status_col.value(i).to_string(),
            tags: tags,
            last_indexed_at: last_indexed_at,
            created_at: None,
        });
    }

    return videos;
}
