import { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Messenger from './pages/Messenger';

export default function App() {
return (
<Routes>
<Route path="/" element={<Home />} />
<Route path="/app" element={<Messenger />} />
</Routes>
);
}
const BACKEND = 'https://expert-couscous-r4gg6p6qv6jpfxq75-3001.app.github.dev'; // or relative if proxying

type Channel = { id: string; name: string; is_im?: boolean; };

function App() {
  const [connected, setConnected] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channel, setChannel] = useState('');
  const [text, setText] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [scheduled, setScheduled] = useState<any[]>([]);

  const installUrl = `${BACKEND}/slack/install`;

  const loadChannels = async () => {
    const res = await axios.get(`${BACKEND}/api/channels`);
    setChannels(res.data);
  };

  const loadScheduled = async () => {
    const res = await axios.get(`${BACKEND}/api/scheduled`);
    setScheduled(res.data);
  };

  useEffect(() => {
    // Try to fetch channels; if ok, consider connected
    loadChannels().then(() => setConnected(true)).catch(() => setConnected(false));
    loadScheduled().catch(() => {});
  }, []);

  const sendNow = async () => {
    await axios.post(`${BACKEND}/api/message/send`, { channel, text });
    alert('Sent');
  };

  const schedule = async () => {
    const ts = Math.floor(new Date(dateTime).getTime()/1000);
    await axios.post(`${BACKEND}/api/message/schedule`, { channel, text, post_at: ts });
    alert('Scheduled');
    loadScheduled();
  };

  const cancel = async (id: string, ch: string) => {
    await axios.delete(`${BACKEND}/api/scheduled/${id}`, { params: { channel: ch } });
    loadScheduled();
  };

  return (
    <div style={{ maxWidth: 720, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>Slack Connect</h1>

      {!connected && (
        <div>
          <p>Connect your Slack workspace:</p>
          <a href={installUrl}>Install to Slack</a>
        </div>
      )}

      {connected && (
        <>
          <section>
            <h2>Compose</h2>
            <div>
              <label>Channel</label><br />
              <select value={channel} onChange={e => setChannel(e.target.value)}>
                <option value="">Select channel</option>
                {channels.map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.id}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Message</label><br />
              <textarea value={text} onChange={e => setText(e.target.value)} rows={4} cols={60} />
            </div>
            <div style={{ marginTop: 12 }}>
              <button disabled={!channel || !text} onClick={sendNow}>Send Now</button>
            </div>
            <div style={{ marginTop: 12 }}>
              <label>Schedule time</label><br />
              <input type="datetime-local" value={dateTime} onChange={e => setDateTime(e.target.value)} />
              <div>
                <button disabled={!channel || !text || !dateTime} onClick={schedule}>Schedule</button>
              </div>
            </div>
          </section>

          <section style={{ marginTop: 24 }}>
            <h2>Scheduled Messages</h2>
            <button onClick={loadScheduled}>Refresh</button>
            <ul>
              {scheduled.map(item => (
                <li key={item.id}>
                  <div>
                    <strong>ID:</strong> {item.id} | <strong>Channel:</strong> {item.channel_id} | <strong>Post at:</strong> {dayjs.unix(item.post_at).format('YYYY-MM-DD HH:mm')}
                  </div>
                  <button onClick={() => cancel(item.id, item.channel_id)}>Cancel</button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

export default App;
