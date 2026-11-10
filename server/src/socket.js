import { Server } from 'socket.io';
import { findUserByToken } from './services/auth.js';
import { createMessage } from './services/messages.js';

// Starts socket.io on the same HTTP server as Express.
export function attachSocket(httpServer) {
  const io = new Server(httpServer);

  // Runs once per connection: only users with a valid session token get in.
  io.use(async (socket, next) => {
    const user = await findUserByToken(socket.handshake.auth.token);
    if (!user) return next(new Error('unauthorized'));
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket) => {
    socket.join('general');

    // Saves the message, tells everyone in the room, and answers the sender through the ack.
    socket.on('message:send', async (data, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const room = data?.room;
      if (!socket.rooms.has(room)) return reply({ ok: false, error: 'You are not in that room' });
      try {
        const message = await createMessage(socket.data.user.id, room, data.body);
        io.to(room).emit('message:new', message);
        reply({ ok: true, message });
      } catch (err) {
        if (err.status !== 400) console.error(err);
        reply({ ok: false, error: err.status === 400 ? err.message : 'Server error' });
      }
    });
  });
}
