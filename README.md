# Slack Connect 🚀
A full-stack application that enables users to connect their Slack workspace, send messages immediately, and schedule them for future delivery. This project was built as part of the Refold Intern Assignment.

**Live Demo:** https://slack-connect-1-7dne.vercel.app/

**Working Demo:**
![Demo](assets/Demo for Slack.mp4)


## ✨ Core Features
- **Secure Slack Authentication:** Implements the complete OAuth 2.0 flow to securely connect a user's Slack workspace.
- **Immediate Messaging:** Send messages to any public or private channel the app has been invited to.
- **Message Scheduling:** Schedule messages to be sent at a specific future date and time.
- **Scheduled Message Management:** View a list of all pending messages and cancel them before they are sent.
- **Reliable Delivery:** A persistent cron job on the backend ensures that scheduled messages are sent reliably at their designated time.

## 🛠️ Technology Stack

This project is a monorepo containing two separate applications:

### Frontend
- Framework: React with Vite
- Language: TypeScript
- Styling: CSS
- API Communication: Axios

### Backend
- Framework: Node.js with Express.js
- Language: TypeScript
- Database: SQLite with better-sqlite3
- Scheduling: node-cron
- Slack Integration: @slack/web-api

## 🏗️ Architectural Overview

The application is designed with a modern, decoupled architecture, separating the frontend and backend concerns for better maintainability and scalability.

### Authentication Flow
1. The user clicks "Connect with Slack" on the frontend, which directs them to the backend's `/auth/slack` endpoint.
2. The backend constructs the appropriate Slack authorization URL with the required scopes and redirects the user to Slack.
3. After the user approves, Slack redirects them back to the backend's `/auth/slack/callback` endpoint with a temporary code.
4. The backend exchanges this code for a permanent `access_token` and stores it securely in the SQLite database, associated with the user's `team_id`.
5. Finally, the user is redirected back to the frontend, which now has the `team_id` to make authenticated API calls.

### Scheduling Mechanism
The backend uses **node-cron** to run a job every minute. This job queries the database for any messages whose `send_at` timestamp is in the past and whose status is `pending`. For each message found, it uses the corresponding workspace's access token to post the message to Slack and then updates the message's status to `sent` to prevent duplicates.

## ⚙️ Setup and Installation (Local Development)

To run this project on your local machine, please follow these steps.

### Prerequisites
- Node.js (v18 or later)
- A Slack account and a workspace to test with.

### 1. Clone the Repository
```bash
git clone https://github.com/Aadi7029/Slack-Connect-1.git
cd your-repo-name
```

### 2. Configure Your Slack App
1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app.
2. Navigate to "OAuth & Permissions" and add the following **Bot Token Scopes**:
    - channels:read
    - groups:read
    - chat:write
    - users:read
3. Add a Redirect URL for local development: `http://localhost:8080/auth/slack/callback`.
4. Go to "Basic Information" and find your **Client ID**, **Client Secret**, and **Signing Secret**.

### 3. Backend Setup
```bash
# Navigate to the backend folder
cd backend

# Install dependencies
npm install

# Create a .env file and add your credentials
cp .env.example .env
```

Edit `backend/.env`:
```env
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_SIGNING_SECRET=your_slack_signing_secret
BACKEND_URL=http://localhost:8080
FRONTEND_URL=http://localhost:5173
```

Run backend:
```bash
npm run dev
```
Backend will be running on **http://localhost:8080**.

### 4. Frontend Setup
```bash
# Open a new terminal and navigate to the frontend folder
cd frontend

# Install dependencies
npm install

# Create a .env file
cp .env.example .env
```

Edit `frontend/.env`:
```env
VITE_BACKEND_URL=http://localhost:8080
```

Run frontend:
```bash
npm run dev
```
Frontend will be running on **http://localhost:5173**.

## 🚀 Deployment

- **Frontend** → Vercel
- **Backend** → Render  
- Environment variables on both platforms are used to manage production credentials and URLs securely.

## 🧠 Challenges & Learnings

1. **CORS Issue:** A persistent CORS (Cross-Origin Resource Sharing) issue caused the frontend to receive an empty response from
  the backend, despite logs showing a successful data fetch. This was diagnosed using the browser's Network tab and resolved by ensuring the `FRONTEND_URL` environment variable on Render was correctly configured.
  
2. **Ephemeral Filesystem Limitations:** A key architectural learning was understanding Render's free tier. The ephemeral 
  filesystem wipes the SQLite database on every restart. While acceptable for a demo, a production app would require a persistent storage solution like Render's Persistent Disks or a managed cloud database.

3. **Slack API Token Nuances:**Debugging the authentication flow revealed several subtleties. The app initially failed because 
  it was reading the `access_token` from an incorrect property in Slack's response. Later, channel fetching failed because the token, while valid, lacked newly added scopes, reinforcing the need to re-authenticate after any permission change.

