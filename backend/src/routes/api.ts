import { Router } from 'express';
import axios from 'axios';
import { refreshIfNeeded } from '../slack';

const router = Router();

// For simplicity assume single-team app; store team_id in env or pass from client.
// In a production multi-tenant app, identify team per user/session.
const TEAM_ID = process.env.DEFAULT_TEAM_ID || '';

router.get('/channels', async (req, res) => {
  try {
    const token = await refreshIfNeeded(TEAM_ID);
    // Use conversations.list to get channels user/bot is in
    const result = await axios.get('https://slack.com/api/conversations.list', {
      headers: { Authorization: `Bearer ${token}` },
      params: { types: 'public_channel,private_channel,im,mpim', limit: 200 }
    });
    if (!result.data.ok) return res.status(400).json(result.data);
    res.json(result.data.channels);
  } catch (e:any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/message/send', async (req, res) => {
  try {
    const { channel, text } = req.body;
    const token = await refreshIfNeeded(TEAM_ID);
    const result = await axios.post('https://slack.com/api/chat.postMessage', { channel, text }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json(result.data);
  } catch (e:any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/message/schedule', async (req, res) => {
  try {
    const { channel, text, post_at } = req.body; // post_at unix seconds
    const token = await refreshIfNeeded(TEAM_ID);
    const result = await axios.post('https://slack.com/api/chat.scheduleMessage', { channel, text, post_at }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json(result.data);
  } catch (e:any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/scheduled', async (req, res) => {
  try {
    const token = await refreshIfNeeded(TEAM_ID);
    const result = await axios.get('https://slack.com/api/chat.scheduledMessages.list', {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit: 100 }
    });
    if (!result.data.ok) return res.status(400).json(result.data);
    res.json(result.data.scheduled_messages);
  } catch (e:any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/scheduled/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { channel } = req.query;
    const token = await refreshIfNeeded(TEAM_ID);
    const result = await axios.post('https://slack.com/api/chat.deleteScheduledMessage', { channel, scheduled_message_id: id }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json(result.data);
  } catch (e:any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
