CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  youtube_url TEXT NOT NULL,
  video_id TEXT,
  status TEXT NOT NULL,
  options_json TEXT NOT NULL,
  transcript TEXT,
  transcript_preview TEXT,
  captions_json TEXT,
  article TEXT,
  title TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
