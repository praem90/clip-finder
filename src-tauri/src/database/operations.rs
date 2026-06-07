use std::sync::Arc;

use arrow_array::builder::{ListBuilder, StringBuilder};
use arrow_array::types::{Float32Type, TimestampMicrosecondType};
use arrow_array::{
    Array, FixedSizeListArray, Float32Array, Float64Array, ListArray, PrimitiveArray, RecordBatch,
    RecordBatchIterator, StringArray,
};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use lancedb::query::{ExecutableQuery, QueryBase};
use lancedb::Connection;

use crate::database::models::{Frame, Video};

pub async fn get_videos(connection: &Connection) -> Result<Vec<Video>, String> {
    let table = connection
        .open_table("videos")
        .execute()
        .await
        .map_err(|e| e.to_string())?;
    let batches = table
        .query()
        .limit(100)
        .execute()
        .await
        .map_err(|e| e.to_string())?
        .try_collect::<Vec<_>>()
        .await
        .map_err(|e| e.to_string())?;

    let videos = batches
        .iter()
        .map(|batch| convert_record_batch_to_videos(batch))
        .flatten()
        .collect::<Vec<Video>>();

    Ok(videos)
}

pub async fn get_video_by_id(
    connection: &Connection,
    video_id: String,
) -> Result<Option<Video>, String> {
    let table = connection
        .open_table("videos")
        .execute()
        .await
        .map_err(|e| e.to_string())?;
    let batches = table
        .query()
        .only_if(format!("id = '{}'", video_id))
        .limit(1)
        .execute()
        .await
        .map_err(|e| e.to_string())?
        .try_collect::<Vec<_>>()
        .await
        .map_err(|e| e.to_string())?;

    if batches.is_empty() {
        return Ok(None);
    }

    let videos = batches
        .iter()
        .map(|batch| convert_record_batch_to_videos(batch))
        .flatten()
        .collect::<Vec<Video>>();

    Ok(videos.into_iter().next())
}

pub async fn create_video(connection: &Connection, video: Video) -> Result<Video, String> {
    let table = connection
        .open_table("videos")
        .execute()
        .await
        .map_err(|e| e.to_string())?;

    let mut list_builder = ListBuilder::new(StringBuilder::new());
    for tag in &video.tags {
        list_builder.values().append_value(tag);
    }
    if video.tags.len() == 0 {
        list_builder.values().append_null();
    }
    list_builder.append(true);

    let schema = table.schema().await.map_err(|e| e.to_string())?;
    let record_batch = RecordBatch::try_new(
        schema.clone(),
        vec![
            Arc::new(StringArray::from(vec![video.id.clone()])),
            Arc::new(StringArray::from(vec![video.path.clone()])),
            Arc::new(StringArray::from(vec![video.name.clone()])),
            Arc::new(StringArray::from(vec![video.status.clone()])),
            Arc::new(list_builder.finish()),
            Arc::new(PrimitiveArray::<TimestampMicrosecondType>::from(vec![
                video
                    .last_indexed_at
                    .map(|dt| dt.timestamp_micros())
                    .unwrap_or(0),
            ])),
        ],
    )
    .map_err(|e| e.to_string())?;

    let batches = RecordBatchIterator::new(vec![Ok(record_batch)], schema);
    table
        .add(batches)
        .execute()
        .await
        .map_err(|e| e.to_string())?;

    return Ok(video);
}

pub async fn create_frames(connection: &Connection, frame: Frame) -> Result<(), String> {
    let frames_table = connection
        .open_table("frames")
        .execute()
        .await
        .map_err(|e| e.to_string())?;

    let embeddings = vec![frame.vector.ok_or("Frame is missing its embedding vector")?];
    let vector_array = FixedSizeListArray::from_iter_primitive::<Float32Type, _, _>(
        embeddings
            .into_iter()
            .map(|vec| Some(vec.into_iter().map(Some).collect::<Vec<_>>())),
        512,
    );
    let schema = frames_table.schema().await.map_err(|e| e.to_string())?;
    let record_batch = RecordBatch::try_new(
        schema.clone(),
        vec![
            Arc::new(StringArray::from(vec![frame.video_id])),
            Arc::new(Float64Array::from(vec![frame.timestamp])),
            Arc::new(vector_array),
        ],
    )
    .map_err(|e| e.to_string())?;

    let batches = RecordBatchIterator::new(vec![Ok(record_batch)], schema);
    frames_table
        .add(batches)
        .execute()
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn update_video_status(
    connection: &Connection,
    video_id: String,
    status: String,
) -> Result<(), String> {
    let videos_table = connection
        .open_table("videos")
        .execute()
        .await
        .map_err(|e| e.to_string())?;

    videos_table
        .update()
        .only_if(format!("id = '{}'", video_id))
        .column("status", format!("'{}'", status))
        .execute()
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn search_frames(
    connection: &Connection,
    query_embeddings: &Vec<f32>,
) -> Result<Vec<(Frame, Video)>, String> {
    let frames_table = connection
        .open_table("frames")
        .execute()
        .await
        .map_err(|e| e.to_string())?;
    let frames_batches = frames_table
        .query()
        .nearest_to(query_embeddings.clone())
        .map_err(|e| e.to_string())?
        .distance_type(lancedb::DistanceType::Cosine)
        .distance_range(None, Some(0.75))
        .select(lancedb::query::Select::Columns(vec![
            "video_id".to_string(),
            "timestamp".to_string(),
            "_distance".to_string(),
        ]))
        .limit(100)
        .execute()
        .await
        .map_err(|e| e.to_string())?
        .try_collect::<Vec<_>>()
        .await
        .map_err(|e| e.to_string())?;

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

    let videos_table = connection
        .open_table("videos")
        .execute()
        .await
        .map_err(|e| e.to_string())?;
    let videos_batches = videos_table
        .query()
        .only_if(format!("id IN ({})", video_ids.join(",")))
        .execute()
        .await
        .map_err(|e| e.to_string())?
        .try_collect::<Vec<_>>()
        .await
        .map_err(|e| e.to_string())?;

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
        .column_by_name("last_indexed_at")
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
            .filter_map(|j| {
                if j.is_some() {
                    Some(j.unwrap().to_string())
                } else {
                    None
                }
            })
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

pub async fn delete_video(connection: &Connection, video_id: String) -> Result<(), String> {
    let videos_table = connection
        .open_table("videos")
        .execute()
        .await
        .map_err(|e| e.to_string())?;
    videos_table
        .delete(format!("id = '{}'", video_id).as_str())
        .await
        .map_err(|e| e.to_string())?;

    delete_frames_by_video_id(connection, video_id).await
}

pub async fn delete_frames_by_video_id(
    connection: &Connection,
    video_id: String,
) -> Result<(), String> {
    let frames_table = connection
        .open_table("frames")
        .execute()
        .await
        .map_err(|e| e.to_string())?;
    frames_table
        .delete(format!("video_id = '{}'", video_id).as_str())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
