CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  youtube_url TEXT NOT NULL,
  transcript TEXT NOT NULL,
  article TEXT,
  created_at TEXT NOT NULL
);
