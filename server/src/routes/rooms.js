import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listRooms, getRoomHistory } from '../services/rooms.js';

export const roomsRouter = Router();

// Returns all rooms with member counts and membership status.
roomsRouter.get('/rooms', requireAuth, async (req, res) => {
  res.json(await listRooms(req.user.id));
});

// Returns the last 25 messages of a room for members, oldest first.
roomsRouter.get('/rooms/:room/messages', requireAuth, async (req, res) => {
  res.json(await getRoomHistory(req.user.id, req.params.room));
});
