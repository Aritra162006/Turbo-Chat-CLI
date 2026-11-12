import express from 'express';
import { authRouter } from './routes/auth.js';
import { messagesRouter } from './routes/messages.js';
import { dmsRouter } from './routes/dms.js';
import { statsRouter } from './routes/stats.js';

export const app = express();

app.use(express.json());
app.use('/api', authRouter);
app.use('/api', messagesRouter);
app.use('/api', dmsRouter);
app.use('/api', statsRouter);

// Catches every error. Unexpected ones are logged, and the client only sees "Server error".
app.use((err, req, res, next) => {
  const status = err.status ?? 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Server error' : err.message });
});
