use arrow_array::types::TimestampMicrosecondType;
use arrow_array::{Array, ListArray, PrimitiveArray, StringArray};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use lancedb::query::{ExecutableQuery, QueryBase};
use lancedb::Connection;

use crate::database::models::Video;

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
        .map(|batch| {
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

            (0..batch.num_rows()).map(|i| {
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

                Video {
                    id: id_col.value(i).to_string(),
                    path: path_col.value(i).to_string(),
                    name: name_col.value(i).to_string(),
                    status: status_col.value(i).to_string(),
                    tags: tags,
                    last_indexed_at: last_indexed_at,
                    created_at: None,
                }
            })
        })
        .flatten()
        .collect::<Vec<Video>>();

    Ok(videos)
}
