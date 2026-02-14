-- Sessions table: tracks all Claude Code sessions managed by the app
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    claude_session_id TEXT,
    name TEXT,
    project_path TEXT NOT NULL,
    worktree_path TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    model TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    total_input_tokens INTEGER NOT NULL DEFAULT 0,
    total_output_tokens INTEGER NOT NULL DEFAULT 0,
    total_cache_read_tokens INTEGER NOT NULL DEFAULT 0,
    total_cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
    is_agent_team INTEGER NOT NULL DEFAULT 0,
    team_role TEXT,
    parent_session_id TEXT,
    FOREIGN KEY (parent_session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

-- Index for fast lookups by project
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_path);

-- Index for finding active sessions
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- Worktrees table: tracks git worktrees created for session isolation
CREATE TABLE IF NOT EXISTS worktrees (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    path TEXT NOT NULL,
    base_commit TEXT NOT NULL,
    project_path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    snapshot_path TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Usage tracking: per-message token usage for cost estimation
CREATE TABLE IF NOT EXISTS usage_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cache_read_tokens INTEGER NOT NULL DEFAULT 0,
    cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
    model TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Index for usage queries by session
CREATE INDEX IF NOT EXISTS idx_usage_session ON usage_log(session_id);

-- Index for usage queries by date
CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_log(timestamp);

-- Settings table: key-value store for app settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
    ('theme', '"tokyo-night"'),
    ('fontSize', '14'),
    ('showTerminalDrawer', 'false'),
    ('worktreeBaseDir', '"~/.openclaudgents/worktrees/"'),
    ('worktreeAutoCleanupDays', '4'),
    ('maxWorktrees', '10'),
    ('notificationsEnabled', 'true'),
    ('notifySounds', 'false');
