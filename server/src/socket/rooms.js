import { joinRoom, leaveRoom } from '../services/rooms.js';

export function registerRoomHandlers(io, socket) {
  // Registers room:join listener
  socket.on('room:join', async (data, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      const roomName = data?.room;
      const { name, memberCount, isNew } = await joinRoom(socket.data.user.id, roomName);
      socket.join(name);
      if (isNew) {
        socket.to(name).emit('room:user-joined', {
          room: name,
          username: socket.data.user.username,
        });
      }
      reply({ ok: true, room: { name, memberCount } });
    } catch (err) {
      if (err.status === 400 || err.status === 403 || err.status === 404) {
        return reply({ ok: false, error: err.message });
      }
      console.error(err);
      reply({ ok: false, error: 'Server error' });
    }
  });

  // Registers room:leave listener
  socket.on('room:leave', async (data, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      const roomName = data?.room;
      await leaveRoom(socket.data.user.id, roomName);
      socket.to(roomName).emit('room:user-left', {
        room: roomName,
        username: socket.data.user.username,
      });
      socket.leave(roomName);
      reply({ ok: true });
    } catch (err) {
      if (err.status === 400 || err.status === 403 || err.status === 404) {
        return reply({ ok: false, error: err.message });
      }
      console.error(err);
      reply({ ok: false, error: 'Server error' });
    }
  });
}
