import { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';

type Channel = { id: string; name?: string };

export default function Messenger() {
const [channels, setChannels] = useState<Channel[]>([]);
const [channel, setChannel] = useState('');
const [text, setText] = useState('');
const [dateTime, setDateTime] = useState('');
const [scheduled, setScheduled] = useState<any[]>([]);
const [loadingChannels, setLoadingChannels] = useState(false);
const [sending, setSending] = useState(false);
const [scheduling, setScheduling] = useState(false);

const loadChannels = async () => {
setLoadingChannels(true);
try {
const res = await axios.get('/api/channels');
setChannels(res.data);
} finally {
setLoadingChannels(false);
}
};
const loadScheduled = async () => {
try {
const res = await axios.get('/api/scheduled');
setScheduled(res.data);
} catch {
// ignore
}
};

useEffect(() => {
loadChannels().catch(() => {});
loadScheduled().catch(() => {});
}, []);

const sendNow = async () => {
if (!channel || !text) return;
setSending(true);
try {
await axios.post('/api/message/send', { channel, text });
setText('');
alert('Message sent');
} catch (e: any) {
alert(Send failed: ${e?.response?.data?.error || e.message});
} finally {
setSending(false);
}
};

const schedule = async () => {
if (!channel || !text || !dateTime) return;
const post_at = Math.floor(new Date(dateTime).getTime() / 1000);
setScheduling(true);
try {
await axios.post('/api/message/schedule', { channel, text, post_at });
setText('');
setDateTime('');
await loadScheduled();
alert('Message scheduled');
} catch (e: any) {
alert(Schedule failed: ${e?.response?.data?.error || e.message});
} finally {
setScheduling(false);
}
};

const cancel = async (id: string, ch: string) => {
try {
await axios.delete(/api/scheduled/${id}, { params: { channel: ch } });
await loadScheduled();
} catch (e: any) {
alert(Cancel failed: ${e?.response?.data?.error || e.message});
}
};

return (
<div style={{ maxWidth: 820, margin: '2rem auto', fontFamily: 'system-ui, sans-serif' }}>
<h1>Slack Messenger</h1>
  <section style={{ marginTop: 12 }}>
    <h2>Select channel</h2>
    {loadingChannels ? (
      <div>Loading channels…</div>
    ) : (
      <select value={channel} onChange={(e) => setChannel(e.target.value)}>
        <option value="">Select a channel</option>
        {channels.map((c) => (
          <option key={c.id} value={c.id}>{c.name || c.id}</option>
        ))}
      </select>
    )}
  </section>

  <section style={{ marginTop: 16 }}>
    <h2>Compose</h2>
    <textarea
      rows={4}
      cols={70}
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder="Type your message…"
    />
    <div style={{ marginTop: 8 }}>
      <button disabled={!channel || !text || sending} onClick={sendNow}>
        {sending ? 'Sending…' : 'Send Now'}
      </button>
    </div>
  </section>

  <section style={{ marginTop: 16 }}>
    <h2>Schedule</h2>
    <input
      type="datetime-local"
      value={dateTime}
      onChange={(e) => setDateTime(e.target.value)}
    />
    <div style={{ marginTop: 8 }}>
      <button disabled={!channel || !text || !dateTime || scheduling} onClick={schedule}>
        {scheduling ? 'Scheduling…' : 'Schedule'}
      </button>
    </div>
  </section>

  <section style={{ marginTop: 24 }}>
    <h2>Scheduled Messages</h2>
    <button onClick={loadScheduled}>Refresh</button>
    <ul>
      {scheduled.map((item) => (
        <li key={item.id} style={{ marginTop: 8 }}>
          <div>
            ID: {item.id} | Channel: {item.channel_id} | Post at:{' '}
            {dayjs.unix(item.post_at).format('YYYY-MM-DD HH:mm')}
          </div>
          <button onClick={() => cancel(item.id, item.channel_id)}>Cancel</button>
        </li>
      ))}
      {scheduled.length === 0 && <li>No scheduled messages</li>}
    </ul>
  </section>
</div>
);
}