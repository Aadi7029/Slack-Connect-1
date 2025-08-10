import axios from 'axios';
import db from './db/sqlite';
import dotenv from 'dotenv';
dotenv.config();

const clientId = process.env.SLACK_CLIENT_ID!;
const clientSecret = process.env.SLACK_CLIENT_SECRET!;
const redirectUri = process.env.SLACK_REDIRECT_URI!;

type Installation = {
  team_id: string,
  access_token: string,
  refresh_token: string,
  expires_at: number
};

export function getInstallation(team_id: string): Installation | undefined {
  const row = db.prepare('SELECT team_id, access_token, refresh_token, expires_at FROM installations WHERE team_id = ?').get(team_id);
  return row;
}

export function saveInstallation(inst: {
  team_id: string,
  access_token: string,
  refresh_token: string,
  expires_in: number
}) {
  const expires_at = Math.floor(Date.now()/1000) + inst.expires_in - 60; // refresh 60s early
  db.prepare(`
    INSERT INTO installations (team_id, access_token, refresh_token, expires_at)
    VALUES (@team_id, @access_token, @refresh_token, @expires_at)
    ON CONFLICT(team_id) DO UPDATE SET
      access_token=@access_token,
      refresh_token=@refresh_token,
      expires_at=@expires_at
  `).run({ ...inst, expires_at });
}

async function exchangeCodeForTokens(code: string) {
  const params = new URLSearchParams();
  params.set('client_id', clientId);
  params.set('client_secret', clientSecret);
  params.set('code', code);
  params.set('redirect_uri', redirectUri);

  const res = await axios.post('https://slack.com/api/oauth.v2.access', params);
  if (!res.data.ok) throw new Error(res.data.error || 'oauth.v2.access failed');
  // With token rotation enabled, response includes expires_in and refresh_token
  // For bot token: res.data.access_token, res.data.expires_in, res.data.refresh_token
  // team info: res.data.team.id
  return res.data;
}

export async function handleOAuthCallback(code: string) {
  const data = await exchangeCodeForTokens(code);
  const team_id = data.team?.id;
  if (!team_id) throw new Error('No team id in OAuth response');

  // Save tokens (bot token path)
  saveInstallation({
    team_id,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in
  });

  return team_id;
}

export async function refreshIfNeeded(team_id: string): Promise<string> {
  const inst = getInstallation(team_id);
  if (!inst) throw new Error('No installation for team');
  const now = Math.floor(Date.now()/1000);
  if (inst.expires_at > now) {
    return inst.access_token;
  }
  // Refresh using oauth.v2.access grant_type=refresh_token
  const params = new URLSearchParams();
  params.set('client_id', clientId);
  params.set('client_secret', clientSecret);
  params.set('grant_type', 'refresh_token');
  params.set('refresh_token', inst.refresh_token);

  const res = await axios.post('https://slack.com/api/oauth.v2.access', params);
  if (!res.data.ok) throw new Error(res.data.error || 'refresh failed');

  // Save the rotated tokens
  saveInstallation({
    team_id,
    access_token: res.data.access_token,
    refresh_token: res.data.refresh_token,
    expires_in: res.data.expires_in
  });

  return res.data.access_token;
}
