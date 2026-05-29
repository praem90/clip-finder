use chrono::DateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Video {
    pub id: String,
    pub name: String,
    pub path: String,
    pub status: String,
    pub tags: Vec<String>,
    pub last_indexed_at: Option<DateTime<chrono::Utc>>,
    pub created_at: Option<DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Frame {
    pub video_id: String,
    pub timestamp: i64,
    pub vector: Vec<f32>,
}
