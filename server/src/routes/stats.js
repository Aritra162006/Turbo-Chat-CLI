import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { mostActiveRooms } from '../services/stats.js';

export const statsRouter = Router();

// Returns the five most active rooms from the last seven days.
statsRouter.get('/stats/rooms', requireAuth, async (req, res) => {
  res.json(await mostActiveRooms());
});
