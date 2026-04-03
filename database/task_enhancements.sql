-- Task enhancements: Microsoft To Do-inspired features for Signal
-- Adds starred, session planning, steps, and notes to deliverables

-- Star/importance toggle (binary, like Microsoft To Do)
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;

-- "Today's Session" — the date this task was added to the daily session
-- Resets conceptually each day (UI filters by today's date)
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS session_date DATE DEFAULT NULL;

-- Steps/subtasks as JSONB array: [{ "id": "uuid", "text": "...", "done": false }]
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT '[]'::jsonb;

-- Free-text notes field
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- Custom list assignment (null = default/inbox)
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS list_name TEXT DEFAULT NULL;

-- Index for session queries (find today's session tasks quickly)
CREATE INDEX IF NOT EXISTS idx_deliverables_session_date ON deliverables(session_date) WHERE session_date IS NOT NULL;

-- Index for starred queries
CREATE INDEX IF NOT EXISTS idx_deliverables_starred ON deliverables(is_starred) WHERE is_starred = TRUE;
