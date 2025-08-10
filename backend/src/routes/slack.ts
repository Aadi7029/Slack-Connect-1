import { Router } from 'express';
import dotenv from 'dotenv';
import { handleOAuthCallback } from '../slack';
dotenv.config();

const router = Router();

router.get('/install', (req, res) => {
  const clientId = process.env.SLACK_CLIENT_ID!;
  const redirect = process.env.SLACK_REDIRECT_URI!;
  const scopes = ['chat:write','channels:read','groups:read','im:read','mpim:read'].join(',');
  const url = `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(scopes)}&user_scope=&redirect_uri=${encodeURIComponent(redirect)}`;
  res.redirect(url);
});

router.get('/oauth/callback', async (req, res) => {
  const code = req.query.code as string;
  try {
    const team_id = await handleOAuthCallback(code);
    res.redirect('FRONTEND_URL/app')
    res.send('Slack connected! You can go back to the app.');
  } catch (e:any) {
    res.status(500).send(`OAuth failed: ${e.message}`);
  }
});

export default router;
