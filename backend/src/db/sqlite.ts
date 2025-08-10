import Database from 'better-sqlite3';

const db = new Database('app.db');

// Tokens table: one row per team (or enterprise)
// Fields: team_id, access_token, refresh_token, expires_at (unix seconds), bot_user_id, scope, installed_by
db.exec(`
CREATE TABLE IF NOT EXISTS installations (
  team_id TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  bot_user_id TEXT,
  scope TEXT,
  installed_by TEXT
);
`);

export default db;
