"use strict";
// backend/src/index.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importStar(require("express"));
const web_api_1 = require("@slack/web-api");
const node_cron_1 = __importDefault(require("node-cron"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const database_1 = __importStar(require("./database"));
// Load environment variables from .env file
dotenv_1.default.config();
// --- INITIALIZATION ---
const app = (0, express_1.default)();
const port = process.env.PORT || 8080; // Use Render's port or default to 8080
const client = new web_api_1.WebClient();
// --- MIDDLEWARE ---
// Enable CORS for your frontend to communicate with the backend
app.use((0, cors_1.default)({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
// Parse JSON bodies from incoming requests
app.use(express_1.default.json());
// --- DATABASE INITIALIZATION ---
// This ensures our tables are ready before the server starts handling requests
(0, database_1.initializeDatabase)();
// --- OAUTH 2.0 FLOW ---
// 1. Redirect to Slack's authorization page
app.get('/auth/slack', (req, res) => {
    const scopes = ['chat:write', 'channels:read', 'users:read'];
    const redirectUri = `${process.env.BACKEND_URL}/auth/slack/callback`;
    const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${process.env.SLACK_CLIENT_ID}&scope=${scopes.join(',')}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    res.redirect(authUrl);
});
// 2. Handle the callback from Slack after user authorization
app.get('/auth/slack/callback', async (req, res) => {
    const code = req.query.code;
    const redirectUri = `${process.env.BACKEND_URL}/auth/slack/callback`;
    if (!code) {
        return res.status(400).send('Error: No authorization code provided.');
    }
    try {
        // Exchange the temporary code for an access token
        const tokenResponse = await client.oauth.v2.access({
            code: code,
            client_id: process.env.SLACK_CLIENT_ID,
            client_secret: process.env.SLACK_CLIENT_SECRET,
            redirect_uri: redirectUri,
        });
        if (!tokenResponse.ok || !tokenResponse.authed_user || !tokenResponse.team) {
            console.error('Slack OAuth Error:', tokenResponse.error);
            return res.status(500).send(`Slack API error: ${tokenResponse.error}`);
        }
        const teamId = tokenResponse.team.id;
        const accessToken = tokenResponse.authed_user.access_token;
        // Note: Slack's oauth.v2.access does not provide a refresh token by default.
        // To get a refresh token, you must configure token rotation in your Slack App settings.
        // For this assignment, we'll proceed assuming we have the access token.
        const refreshToken = "dummy_refresh_token"; // Placeholder
        // Store or update the token in the database
        const stmt = database_1.default.prepare('INSERT INTO workspaces (team_id, access_token, refresh_token) VALUES (?, ?, ?) ON CONFLICT(team_id) DO UPDATE SET access_token = excluded.access_token, refresh_token = excluded.refresh_token');
        stmt.run(teamId, accessToken, refreshToken);
        // Redirect user to the frontend, indicating success
        res.redirect(`${process.env.FRONTEND_URL}/success?team_id=${teamId}`);
    }
    catch (error) {
        console.error('Error during OAuth callback:', error);
        res.status(500).send('An internal server error occurred.');
    }
});
// --- API ENDPOINTS ---
// Get a list of public channels for a given team
app.get('/api/channels', async (req, res) => {
    const teamId = req.query.team_id;
    if (!teamId) {
        return res.status(400).json({ error: 'Team ID is required.' });
    }
    try {
        const row = database_1.default.prepare('SELECT access_token FROM workspaces WHERE team_id = ?').get(teamId);
        if (!row) {
            return res.status(404).json({ error: 'Workspace not found. Please re-authenticate.' });
        }
        const slackClient = new web_api_1.WebClient(row.access_token);
        const result = await slackClient.conversations.list({
            types: 'public_channel',
            limit: 200 // Adjust as needed
        });
        res.json(result.channels);
    }
    catch (error) {
        console.error('Error fetching channels:', error);
        res.status(500).json({ error: 'Failed to fetch channels.' });
    }
});
// Send a message immediately
app.post('/api/messages/send', async (req, res) => {
    const { team_id, channel_id, message_text } = req.body;
    if (!team_id || !channel_id || !message_text) {
        return res.status(400).json({ error: 'Missing required fields: team_id, channel_id, message_text' });
    }
    try {
        const row = database_1.default.prepare('SELECT access_token FROM workspaces WHERE team_id = ?').get(team_id);
        if (!row) {
            return res.status(404).json({ error: 'Workspace not found.' });
        }
        const slackClient = new web_api_1.WebClient(row.access_token);
        await slackClient.chat.postMessage({
            channel: channel_id,
            text: message_text
        });
        res.status(200).json({ success: true, message: 'Message sent successfully!' });
    }
    catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message.' });
    }
});
// Schedule a message for future delivery
app.post('/api/messages/schedule', (req, res) => {
    const { team_id, channel_id, message_text, send_at } = req.body; // send_at should be a Unix timestamp
    if (!team_id || !channel_id || !message_text || !send_at) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }
    try {
        const stmt = database_1.default.prepare('INSERT INTO scheduled_messages (team_id, channel_id, message_text, send_at) VALUES (?, ?, ?, ?)');
        stmt.run(team_id, channel_id, message_text, send_at);
        res.status(201).json({ success: true, message: 'Message scheduled successfully!' });
    }
    catch (error) {
        console.error('Error scheduling message:', error);
        res.status(500).json({ error: 'Failed to schedule message.' });
    }
});
// Get a list of all currently scheduled messages for a team
app.get('/api/messages/scheduled', (req, res) => {
    const teamId = req.query.team_id;
    if (!teamId) {
        return res.status(400).json({ error: 'Team ID is required.' });
    }
    try {
        const messages = database_1.default.prepare("SELECT id, channel_id, message_text, send_at FROM scheduled_messages WHERE team_id = ? AND status = 'pending'").all(teamId);
        res.json(messages);
    }
    catch (error) {
        console.error('Error fetching scheduled messages:', error);
        res.status(500).json({ error: 'Failed to fetch scheduled messages.' });
    }
});
// Cancel/delete a scheduled message
app.delete('/api/messages/scheduled/:id', (req, res) => {
    const { id } = req.params;
    try {
        const stmt = database_1.default.prepare('DELETE FROM scheduled_messages WHERE id = ?');
        const result = stmt.run(id);
        if (result.changes > 0) {
            res.status(200).json({ success: true, message: 'Scheduled message cancelled.' });
        }
        else {
            res.status(404).json({ error: 'Scheduled message not found.' });
        }
    }
    catch (error) {
        console.error('Error cancelling message:', error);
        res.status(500).json({ error: 'Failed to cancel message.' });
    }
});
// --- CRON JOB FOR SCHEDULER ---
// This job runs every minute to check for and send scheduled messages.
node_cron_1.default.schedule('* * * * *', async () => {
    console.log('Running cron job to send scheduled messages...');
    const now = Math.floor(Date.now() / 1000);
    try {
        const messages = database_1.default.prepare("SELECT * FROM scheduled_messages WHERE send_at <= ? AND status = 'pending'").all(now);
        for (const msg of messages) {
            console.log(`Sending message ID: ${msg.id}`);
            const row = database_1.default.prepare('SELECT access_token FROM workspaces WHERE team_id = ?').get(msg.team_id);
            if (row && row.access_token) {
                try {
                    const slackClient = new web_api_1.WebClient(row.access_token);
                    await slackClient.chat.postMessage({
                        channel: msg.channel_id,
                        text: msg.message_text,
                    });
                    // Update status to 'sent' to prevent re-sending
                    database_1.default.prepare("UPDATE scheduled_messages SET status = 'sent' WHERE id = ?").run(msg.id);
                    console.log(`Message ID: ${msg.id} sent successfully.`);
                }
                catch (error) {
                    console.error(`Failed to send message ID ${msg.id}:`, error.data?.error || error.message);
                    // Update status to 'failed'
                    database_1.default.prepare("UPDATE scheduled_messages SET status = 'failed' WHERE id = ?").run(msg.id);
                }
            }
            else {
                console.warn(`No active token found for team_id ${msg.team_id}. Skipping message ${msg.id}.`);
                database_1.default.prepare("UPDATE scheduled_messages SET status = 'failed' WHERE id = ?").run(msg.id);
            }
        }
    }
    catch (error) {
        console.error('Cron job error:', error);
    }
});
// --- START SERVER ---
app.listen(port, () => {
    console.log(`🚀 Backend server is running on http://localhost:${port}`);
});
//# sourceMappingURL=index.js.map