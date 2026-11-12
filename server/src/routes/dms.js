import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listConversations,
  getConversation,
  markRead,
} from '../services/dms.js';

export const dmsRouter = Router();

// Returns all DM conversations with unread counts.
dmsRouter.get('/dms', requireAuth, async (req, res) => {
  res.json(await listConversations(req.user.id));
});

// Returns the conversation history with a user.
dmsRouter.get('/dms/:username/messages', requireAuth, async (req, res) => {
  const before = req.query.before === undefined
    ? undefined
    : Number(req.query.before);

  res.json(await getConversation(req.user.id, req.params.username, before));
});

// Marks the conversation as read.
dmsRouter.post('/dms/:username/read', requireAuth, async (req, res) => {
  await markRead(req.user.id, req.params.username);
  res.status(204).end();
});
