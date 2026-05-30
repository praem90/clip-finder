use lancedb::{
    arrow::arrow_schema::{DataType, Field, Schema, TimeUnit},
    Connection as LanceDbConnection,
};

use std::sync::Arc;

pub type Connection = Arc<LanceDbConnection>;

pub async fn init(path: &str) -> Result<Connection, String> {
    let exists = std::path::Path::new(path).exists();
    println!(
        "Checking for database file at {}: {}",
        path,
        if exists { "found" } else { "not found" }
    );
    let conn = lancedb::connect(path).execute().await.unwrap();
    if !exists {
        println!(
            "No database file found at {}, creating new database and tables.",
            path
        );
        create_tables(&conn).await.unwrap();
    } else {
        println!(
            "Database file found at {}, opening existing database.",
            path
        );
    }

    Ok(Arc::new(conn))
}

pub async fn create_tables(db: &LanceDbConnection) -> Result<(), Box<dyn std::error::Error>> {
    let video_schema = Arc::new(Schema::new(vec![
        Field::new("id", DataType::Utf8, false),
        Field::new("path", DataType::Utf8, false),
        Field::new("name", DataType::Utf8, false),
        Field::new("status", DataType::Utf8, false),
        Field::new(
            "tags",
            DataType::List(Arc::new(Field::new("item", DataType::Utf8, true))),
            true,
        ),
        Field::new(
            "last_indexed_at",
            DataType::Timestamp(TimeUnit::Microsecond, None),
            true,
        ),
    ]));
    let create_videos_table = db
        .create_empty_table("videos", video_schema)
        .execute()
        .await;

    if let Err(e) = create_videos_table {
        if !e.to_string().contains("already exists") {
            eprintln!("Error creating videos table: {}", e);
        }
    };

    let frame_schema = Arc::new(Schema::new(vec![
        Field::new("video_id", DataType::Utf8, false),
        Field::new("timestamp", DataType::Float64, false),
        Field::new(
            "vector",
            DataType::FixedSizeList(Arc::new(Field::new("item", DataType::Float32, false)), 512),
            true,
        ),
    ]));

    let create_frames_table = db
        .create_empty_table("frames", frame_schema)
        .execute()
        .await;
    if let Err(e) = create_frames_table {
        if !e.to_string().contains("already exists") {
            eprintln!("Error creating frames table: {}", e);
        }
    };

    Ok(())
}
