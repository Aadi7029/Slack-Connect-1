export default function Home() {
const installUrl = '/slack/install';

return (
<div style={{ maxWidth: 720, margin: '2rem auto', fontFamily: 'system-ui, sans-serif' }}>
<h1>Connect to Slack</h1>
<p>Install the app to your Slack workspace to continue.</p>
<a href={installUrl}>
<button style={{ padding: '10px 16px', fontSize: 16 }}>Connect to Slack</button>
</a>
</div>
);
}