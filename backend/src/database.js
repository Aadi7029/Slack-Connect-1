"use strict";
// backend/src/database.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabase = initializeDatabase;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
// This will create a new file 'data.db' in your backend's root directory if it doesn't exist.
// The 'verbose' option is helpful for debugging during development.
const db = new better_sqlite3_1.default('data.db', { verbose: console.log });
/**
 * Initializes the database tables if they don't already exist.
 * This function should be called once when the application starts.
 */
function initializeDatabase() {
    console.log('Initializing database...');
    // SQL statement to create the 'workspaces' table.
    // This table stores the essential tokens for each Slack workspace that installs the app.
    const createWorkspacesTable = `
    CREATE TABLE IF NOT EXISTS workspaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id TEXT NOT NULL UNIQUE,          -- Slack's unique ID for the workspace
      access_token TEXT NOT NULL,          -- The token to make API calls
      refresh_token TEXT NOT NULL,         -- The token to get a new access_token
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;
    // SQL statement to create the 'scheduled_messages' table.
    // This table holds all the messages waiting to be sent.
    const createScheduledMessagesTable = `
    CREATE TABLE IF NOT EXISTS scheduled_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id TEXT NOT NULL,                 -- Identifies which workspace this message belongs to
      channel_id TEXT NOT NULL,              -- The channel to post the message in
      message_text TEXT NOT NULL,            -- The content of the message
      send_at INTEGER NOT NULL,              -- The time to send the message (as a Unix timestamp)
      status TEXT DEFAULT 'pending'          -- Status can be 'pending', 'sent', or 'failed'
    );
  `;
    // Execute the SQL statements to create the tables.
    // Using .exec() is good for running one or more statements that don't return rows.
    db.exec(createWorkspacesTable);
    db.exec(createScheduledMessagesTable);
    console.log('Database initialized successfully.');
}
// Export the database connection object so it can be used in other files.
exports.default = db;
//# sourceMappingURL=database.js.map