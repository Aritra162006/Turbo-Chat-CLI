import { Server } from 'socket.io';
import { findUserByToken } from './services/auth.js';
import { createMessage } from './services/messages.js';
import { registerDmHandlers } from './socket/dms.js';

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

    // Presence. Every connection of a user joins user:<id>, so that room's size is how many tabs they have open.
    const { username } = socket.data.user;
    const userRoom = `user:${socket.data.user.id}`;
    socket.join(userRoom);
    if (io.sockets.adapter.rooms.get(userRoom).size === 1) {
      socket.broadcast.emit('user:joined', { username });
    }

    // socket.io has already removed this socket from its rooms here, so an empty user room means the last tab closed.
    socket.on('disconnect', () => {
      if (!io.sockets.adapter.rooms.has(userRoom)) {
        io.emit('user:left', { username });
      }
    });

    // Names of everyone with at least one open connection, sorted, no duplicates.
    socket.on('users:list', (ack) => {
      if (typeof ack !== 'function') return;
      const names = new Set();
      for (const s of io.sockets.sockets.values()) names.add(s.data.user.username);
      ack({ ok: true, users: [...names].sort() });
    });

    // Register personal DM room and DM events.
    registerDmHandlers(io, socket);

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
