use lancedb::{
    arrow::arrow_schema::{DataType, Field, Schema, TimeUnit},
    Connection as LanceDbConnection,
};
use std::sync::Arc;

pub type Connection = Arc<LanceDbConnection>;

pub async fn init(path: &str) -> Result<Connection, String> {
    let conn = lancedb::connect(path).execute().await.unwrap();
    create_tables(&conn).await.unwrap();

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
