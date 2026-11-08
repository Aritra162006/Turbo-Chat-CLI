import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getGeneralHistory } from '../services/messages.js';

export const messagesRouter = Router();

// Returns the last 25 messages of the general room, oldest first.
messagesRouter.get('/rooms/general/messages', requireAuth, async (req, res) => {
  res.json(await getGeneralHistory());
});
