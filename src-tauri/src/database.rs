use arrow_json::ArrayWriter;
use futures::TryStreamExt;
use lancedb::query::{ExecutableQuery, QueryBase};
use lancedb::{
    arrow::arrow_schema::{DataType, Field, Schema, TimeUnit},
    Connection,
};
use tauri::State;

use std::sync::Arc;

use crate::AppState;

pub async fn create_tables(db: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    let video_schema = Arc::new(Schema::new(vec![
        Field::new("id", DataType::Utf8, false),
        Field::new("path", DataType::Utf8, false),
        Field::new("name", DataType::Utf8, false),
        Field::new("status", DataType::Utf8, false),
        Field::new(
            "tags",
            DataType::List(Arc::new(Field::new("item", DataType::Utf8, false))),
            true,
        ),
        Field::new(
            "last_indexed_at",
            DataType::Timestamp(TimeUnit::Microsecond, None),
            true,
        ),
    ]));
    db.create_empty_table("videos", video_schema);
    Ok(())
}

#[tauri::command]
pub async fn get_videos(state: State<'_, AppState>) -> Result<String, String> {
    let table = &state.db.open_table("videos").execute().await.unwrap();
    let batches = table
        .query()
        .limit(100)
        .execute()
        .await
        .unwrap()
        .try_collect::<Vec<_>>()
        .await
        .unwrap();

    let mut buffer = Vec::new();
    let mut writter = ArrayWriter::new(&mut buffer);

    for batch in batches.iter() {
        writter.write_batches(&[batch]).unwrap();
    }

    writter.finish().unwrap();

    Ok(String::from_utf8(buffer).unwrap().to_string())
}
