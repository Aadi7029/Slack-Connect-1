// frontend/src/App.tsx

import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css'; // We'll add some basic styling

// --- Helper Components ---

const Login = () => {
    // The backend URL is read from an environment variable
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
    return (
        <div className="container">
            <h1>Slack Message Scheduler</h1>
            <p>Connect your Slack workspace to start sending and scheduling messages.</p>
            <a href={`${backendUrl}/auth/slack`} className="slack-btn">
                <img src="https://cdn.bfldr.com/5H442O3W/at/pl546j-7le8zk-6gwiyo/Slack_Mark.svg?auto=webp&format=png" alt="Slack Logo" />
                Connect with Slack
            </a>
        </div>
    );
};

const Dashboard = ({ teamId }: { teamId: string }) => {
    return (
        <div className="container">
            <h1>Dashboard</h1>
            <p>Connected to workspace with Team ID: <strong>{teamId}</strong></p>
            <hr />
            <MessageComposer teamId={teamId} />
            <hr />
            <ScheduledMessagesList teamId={teamId} />
        </div>
    );
};


// --- Main Application Components ---

const MessageComposer = ({ teamId }: { teamId: string }) => {
    const [channels, setChannels] = useState<any[]>([]);
    const [selectedChannel, setSelectedChannel] = useState('');
    const [message, setMessage] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    useEffect(() => {
        // Fetch channels when the component mounts
        const fetchChannels = async () => {
            try {
                const response = await axios.get(`${backendUrl}/api/channels?team_id=${teamId}`);
                setChannels(response.data);
                if (response.data.length > 0) {
                    setSelectedChannel(response.data[0].id);
                }
            } catch (error) {
                console.error("Failed to fetch channels", error);
                setStatusMessage('Error: Could not fetch channels.');
            }
        };
        fetchChannels();
    }, [teamId, backendUrl]);

    const handleSubmit = async (isScheduled: boolean) => {
        if (!selectedChannel || !message) {
            setStatusMessage('Please select a channel and write a message.');
            return;
        }

        const endpoint = isScheduled ? '/api/messages/schedule' : '/api/messages/send';
        const payload: any = {
            team_id: teamId,
            channel_id: selectedChannel,
            message_text: message
        };

        if (isScheduled) {
            if (!scheduleTime) {
                setStatusMessage('Please select a date and time to schedule the message.');
                return;
            }
            // Convert local datetime string to Unix timestamp
            payload.send_at = Math.floor(new Date(scheduleTime).getTime() / 1000);
        }

        try {
            const response = await axios.post(`${backendUrl}${endpoint}`, payload);
            setStatusMessage(response.data.message);
            setMessage(''); // Clear message input on success
        } catch (error: any) {
            console.error("API Error:", error);
            setStatusMessage(`Error: ${error.response?.data?.error || 'An unknown error occurred.'}`);
        }
    };

    return (
        <div className="composer">
            <h2>Compose Message</h2>
            <select value={selectedChannel} onChange={e => setSelectedChannel(e.target.value)} required>
                <option value="" disabled>Select a channel</option>
                {channels.map(channel => (
                    <option key={channel.id} value={channel.id}>
                        #{channel.name}
                    </option>
                ))}
            </select>
            <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Write your message here..."
                rows={5}
                required
            />
            <div className="actions">
                <button onClick={() => handleSubmit(false)}>Send Now</button>
                <div className="schedule-action">
                    <input
                        type="datetime-local"
                        value={scheduleTime}
                        onChange={e => setScheduleTime(e.target.value)}
                    />
                    <button onClick={() => handleSubmit(true)}>Schedule</button>
                </div>
            </div>
            {statusMessage && <p className="status">{statusMessage}</p>}
        </div>
    );
};

const ScheduledMessagesList = ({ teamId }: { teamId: string }) => {
    const [scheduled, setScheduled] = useState<any[]>([]);
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    const fetchScheduledMessages = async () => {
        try {
            const response = await axios.get(`${backendUrl}/api/messages/scheduled?team_id=${teamId}`);
            setScheduled(response.data);
        } catch (error) {
            console.error("Failed to fetch scheduled messages", error);
        }
    };

    useEffect(() => {
        fetchScheduledMessages();
        const interval = setInterval(fetchScheduledMessages, 10000); // Refresh every 10 seconds
        return () => clearInterval(interval);
    }, [teamId, backendUrl]);

    const handleCancel = async (id: number) => {
        try {
            await axios.delete(`${backendUrl}/api/messages/scheduled/${id}`);
            fetchScheduledMessages(); // Refresh the list after cancelling
        } catch (error) {
            console.error("Failed to cancel message", error);
        }
    };

    return (
        <div className="scheduled-list">
            <h2>Scheduled Messages</h2>
            {scheduled.length === 0 ? <p>No messages are currently scheduled.</p> : (
                <ul>
                    {scheduled.map(msg => (
                        <li key={msg.id}>
                            <div className="msg-details">
                                <span>To: <strong>#{msg.channel_id}</strong></span>
                                <span>On: {new Date(msg.send_at * 1000).toLocaleString()}</span>
                                <p>"{msg.message_text}"</p>
                            </div>
                            <button onClick={() => handleCancel(msg.id)} className="cancel-btn">Cancel</button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};


// --- Main App Component (Router) ---

function App() {
  const [teamId, setTeamId] = useState<string | null>(localStorage.getItem('slack_team_id'));

  // This effect runs once on page load to check the URL for a new team_id from the OAuth redirect
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const newTeamId = queryParams.get('team_id');
    
    if (newTeamId) {
      localStorage.setItem('slack_team_id', newTeamId);
      setTeamId(newTeamId);
      // Clean up the URL by removing the query parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Simple router logic
  if (teamId) {
    return <Dashboard teamId={teamId} />;
  } else {
    return <Login />;
  }
}

export default App;
