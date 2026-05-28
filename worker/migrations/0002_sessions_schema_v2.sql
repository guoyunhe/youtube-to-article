CREATE TABLE IF NOT EXISTS sessions_v2 (
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

INSERT OR REPLACE INTO sessions_v2 (
  id,
  youtube_url,
  video_id,
  status,
  options_json,
  transcript,
  transcript_preview,
  captions_json,
  article,
  title,
  error,
  created_at,
  updated_at
)
SELECT
  id,
  youtube_url,
  NULL,
  'completed',
  '{"taskType":"summary","outputStyle":"professional","targetReaders":"beginners","outputLanguage":"en","customPrompt":""}',
  transcript,
  substr(transcript, 1, 800),
  NULL,
  article,
  NULL,
  NULL,
  created_at,
  created_at
FROM sessions;

DROP TABLE sessions;
ALTER TABLE sessions_v2 RENAME TO sessions;
