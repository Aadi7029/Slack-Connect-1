import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import slackRoutes from './routes/slack';
import apiRoutes from './routes/api';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => res.send('Backend is running. Visit /slack/install to connect.'));

app.use('/slack', slackRoutes);
app.use('/api', apiRoutes);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Backend listening on ${port}`);
});
