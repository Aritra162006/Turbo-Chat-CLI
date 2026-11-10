
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { getGeneralHistory } from '../services/messages.js';

export const messagesRouter = Router();

messagesRouter.get('/rooms/general/messages', requireAuth, async (req, res) => {
  res.json(await getGeneralHistory());
});

messagesRouter.post('/rooms/general/messages', requireAuth, async (req, res) => {
  try {
    const { body } = req.body;

   
    if (typeof body !== 'string' || !body.trim()) {
      return res.status(400).json({
        error: 'Message cannot be empty',
      });
    }

    if (body.trim().length > 2000) {
      return res.status(400).json({
        error: 'Message cannot exceed 2000 characters',
      });
    }

    // Find general room
    const room = await prisma.room.findUnique({
      where: { name: 'general' },
    });

    if (!room) {
      return res.status(404).json({
        error: 'General room not found',
      });
    }

    // Save message in database
    const message = await prisma.message.create({
      data: {
        body: body.trim(),
        roomId: room.id,
        userId: req.user.id,
      },
      include: {
        user: {
          select: {
            username: true,
          },
        },
      },
    });

    // Return saved message
    return res.status(201).json({
      id: message.id,
      username: message.user?.username ?? null,
      body: message.body,
      createdAt: message.createdAt,
    });

  } catch (error) {
    console.error('Send message error:', error);

    return res.status(500).json({
      error: 'Unable to send message',
    });
  }
});
