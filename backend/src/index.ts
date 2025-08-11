// Forcing a redeploy to reset the database
import express, { Request, Response } from 'express';


// backend/src/index.ts

import express, { Request, Response } from 'express';
import { WebClient } from '@slack/web-api';
import cron from 'node-cron';
import dotenv from 'dotenv';
import cors from 'cors';
import db, { initializeDatabase } from './database';

// Load environment variables from .env file
dotenv.config();

// --- INITIALIZATION ---
const app = express();
const port = process.env.PORT || 8080; // Use Render's port or default to 8080
const client = new WebClient();

// --- MIDDLEWARE ---
// Enable CORS for your frontend to communicate with the backend
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' })); 
// Parse JSON bodies from incoming requests
app.use(express.json());

// --- DATABASE INITIALIZATION ---
// This ensures our tables are ready before the server starts handling requests
initializeDatabase();

// --- OAUTH 2.0 FLOW ---

// 1. Redirect to Slack's authorization page
app.get('/auth/slack', (req: Request, res: Response) => {
  const scopes = ['chat:write', 'channels:read', 'users:read'];
  const redirectUri = `${process.env.BACKEND_URL}/auth/slack/callback`;

  const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${process.env.SLACK_CLIENT_ID}&scope=${scopes.join(',')}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  
  res.redirect(authUrl);
});

// 2. Handle the callback from Slack after user authorization
app.get('/auth/slack/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const redirectUri = `${process.env.BACKEND_URL}/auth/slack/callback`;

  if (!code) {
    return res.status(400).send('Error: No authorization code provided.');
  }

  try {
    // Exchange the temporary code for an access token
    const tokenResponse = await client.oauth.v2.access({
      code: code,
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      redirect_uri: redirectUri,
    });

    if (!tokenResponse.ok || !tokenResponse.team) {
      console.error('Slack OAuth Error:', tokenResponse.error);
      return res.status(500).send(`Slack API error: ${tokenResponse.error}`);
    }

    const teamId = tokenResponse.team.id;
    // **FIXED LINE:** Get the access token from the top-level response object
    const accessToken = tokenResponse.access_token; 
    const refreshToken = "dummy_refresh_token"; // Placeholder

    if (!accessToken) {
        console.error('Access Token was not received from Slack.');
        return res.status(500).send('Authentication failed: No access token provided by Slack.');
    }

    // Store or update the token in the database
    const stmt = db.prepare('INSERT INTO workspaces (team_id, access_token, refresh_token) VALUES (?, ?, ?) ON CONFLICT(team_id) DO UPDATE SET access_token = excluded.access_token, refresh_token = excluded.refresh_token');
    stmt.run(teamId, accessToken, refreshToken);
    
    // Redirect user to the frontend, indicating success
    res.redirect(`${process.env.FRONTEND_URL}/?team_id=${teamId}`);

  } catch (error) {
    console.error('Error during OAuth callback:', error);
    res.status(500).send('An internal server error occurred.');
  }
});


// --- API ENDPOINTS ---

// Get a list of public channels for a given team
app.get('/api/channels', async (req: Request, res: Response) => {
    const teamId = req.query.team_id as string;
    if (!teamId) {
        return res.status(400).json({ error: 'Team ID is required.' });
    }

    try {
        const row: any = db.prepare('SELECT access_token FROM workspaces WHERE team_id = ?').get(teamId);
        if (!row) {
            return res.status(404).json({ error: 'Workspace not found. Please re-authenticate.' });
        }
        
        const slackClient = new WebClient(row.access_token);
        const result = await slackClient.conversations.list({
            types: 'public_channel',
            limit: 200 // Adjust as needed
        });

        res.json(result.channels);
    } catch (error) {
        console.error('Error fetching channels:', error);
        res.status(500).json({ error: 'Failed to fetch channels.' });
    }
});

// Send a message immediately
app.post('/api/messages/send', async (req: Request, res: Response) => {
    const { team_id, channel_id, message_text } = req.body;

    if (!team_id || !channel_id || !message_text) {
        return res.status(400).json({ error: 'Missing required fields: team_id, channel_id, message_text' });
    }

    try {
        const row: any = db.prepare('SELECT access_token FROM workspaces WHERE team_id = ?').get(team_id);
        if (!row) {
            return res.status(404).json({ error: 'Workspace not found.' });
        }

        const slackClient = new WebClient(row.access_token);
        await slackClient.chat.postMessage({
            channel: channel_id,
            text: message_text
        });
        
        res.status(200).json({ success: true, message: 'Message sent successfully!' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message.' });
    }
});

// Schedule a message for future delivery
app.post('/api/messages/schedule', (req: Request, res: Response) => {
    const { team_id, channel_id, message_text, send_at } = req.body; // send_at should be a Unix timestamp

    if (!team_id || !channel_id || !message_text || !send_at) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }

    try {
        const stmt = db.prepare('INSERT INTO scheduled_messages (team_id, channel_id, message_text, send_at) VALUES (?, ?, ?, ?)');
        stmt.run(team_id, channel_id, message_text, send_at);
        res.status(201).json({ success: true, message: 'Message scheduled successfully!' });
    } catch (error) {
        console.error('Error scheduling message:', error);
        res.status(500).json({ error: 'Failed to schedule message.' });
    }
});

// Get a list of all currently scheduled messages for a team
app.get('/api/messages/scheduled', (req: Request, res: Response) => {
    const teamId = req.query.team_id as string;
    if (!teamId) {
        return res.status(400).json({ error: 'Team ID is required.' });
    }
    
    try {
        const messages = db.prepare("SELECT id, channel_id, message_text, send_at FROM scheduled_messages WHERE team_id = ? AND status = 'pending'").all(teamId);
        res.json(messages);
    } catch (error) {
        console.error('Error fetching scheduled messages:', error);
        res.status(500).json({ error: 'Failed to fetch scheduled messages.' });
    }
});

// Cancel/delete a scheduled message
app.delete('/api/messages/scheduled/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const stmt = db.prepare('DELETE FROM scheduled_messages WHERE id = ?');
        const result = stmt.run(id);

        if (result.changes > 0) {
            res.status(200).json({ success: true, message: 'Scheduled message cancelled.' });
        } else {
            res.status(404).json({ error: 'Scheduled message not found.' });
        }
    } catch (error) {
        console.error('Error cancelling message:', error);
        res.status(500).json({ error: 'Failed to cancel message.' });
    }
});


// --- CRON JOB FOR SCHEDULER ---
// This job runs every minute to check for and send scheduled messages.
/*
cron.schedule('* * * * *', async () => {
  console.log('Running cron job to send scheduled messages...');
  const now = Math.floor(Date.now() / 1000);

  try {
    const messages: any[] = db.prepare("SELECT * FROM scheduled_messages WHERE send_at <= ? AND status = 'pending'").all(now);

    for (const msg of messages) {
      console.log(`Sending message ID: ${msg.id}`);
      const row: any = db.prepare('SELECT access_token FROM workspaces WHERE team_id = ?').get(msg.team_id);
      
      if (row && row.access_token) {
        try {
          const slackClient = new WebClient(row.access_token);
          await slackClient.chat.postMessage({
            channel: msg.channel_id,
            text: msg.message_text,
          });

          // Update status to 'sent' to prevent re-sending
          db.prepare("UPDATE scheduled_messages SET status = 'sent' WHERE id = ?").run(msg.id);
          console.log(`Message ID: ${msg.id} sent successfully.`);

        } catch (error: any) {
          console.error(`Failed to send message ID ${msg.id}:`, error.data?.error || error.message);
          // Update status to 'failed'
          db.prepare("UPDATE scheduled_messages SET status = 'failed' WHERE id = ?").run(msg.id);
        }
      } else {
        console.warn(`No active token found for team_id ${msg.team_id}. Skipping message ${msg.id}.`);
        db.prepare("UPDATE scheduled_messages SET status = 'failed' WHERE id = ?").run(msg.id);
      }
    }
  } catch (error) {
    console.error('Cron job error:', error);
  }
});
*/


// --- START SERVER ---
app.listen(port, () => {
  console.log(`🚀 Backend server is running on http://localhost:${port}`);
});
