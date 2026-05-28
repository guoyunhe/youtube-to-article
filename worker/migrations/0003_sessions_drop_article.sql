CREATE TABLE IF NOT EXISTS sessions_next (
	id TEXT PRIMARY KEY,
	youtube_url TEXT NOT NULL,
	video_id TEXT,
	status TEXT NOT NULL,
	options_json TEXT NOT NULL,
	transcript TEXT,
	transcript_preview TEXT,
	captions_json TEXT,
	title TEXT,
	error TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

INSERT INTO sessions_next (
	id,
	youtube_url,
	video_id,
	status,
	options_json,
	transcript,
	transcript_preview,
	captions_json,
	title,
	error,
	created_at,
	updated_at
)
SELECT
	id,
	youtube_url,
	video_id,
	status,
	options_json,
	transcript,
	transcript_preview,
	captions_json,
	title,
	error,
	created_at,
	updated_at
FROM sessions;

DROP TABLE sessions;
ALTER TABLE sessions_next RENAME TO sessions;
