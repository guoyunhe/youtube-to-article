CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  parent_id TEXT,
  depth INTEGER NOT NULL,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES sections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sections_session_id ON sections(session_id);
CREATE INDEX IF NOT EXISTS idx_sections_parent_id ON sections(parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sections_session_position ON sections(session_id, position);