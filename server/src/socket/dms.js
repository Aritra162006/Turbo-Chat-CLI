
import { sendDm } from "../services/dms.js";

// Track DM send attempts per user for rate limiting.
const dmAttempts = new Map();

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10_000;

export function registerDmHandlers(io, socket) {
  const userId = socket.data.user.id;
  const senderRoom = `user:${userId}`;

  // Give this socket its own personal room.
  socket.join(senderRoom);

  socket.on("dm:send", async (data, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};

    try {
      const now = Date.now();
      const recentAttempts = (dmAttempts.get(userId) ?? [])
        .filter((timestamp) => now - timestamp < RATE_WINDOW_MS);

      if (recentAttempts.length >= RATE_LIMIT) {
        dmAttempts.set(userId, recentAttempts);
        return reply({
          ok: false,
          error: "Rate limit exceeded. Try again later.",
        });
      }

      recentAttempts.push(now);
      dmAttempts.set(userId, recentAttempts);

      const { dm, recipientId } = await sendDm(
        userId,
        data?.toUsername,
        data?.body
      );

      const recipientRoom = `user:${recipientId}`;
      const recipientOnline = io.sockets.adapter.rooms.has(recipientRoom);

      io.to([senderRoom, recipientRoom]).emit("dm:new", dm);

      reply({
        ok: true,
        message: dm,
        recipientOnline,
      });
    } catch (err) {
      if (err.status === 400 || err.status === 404) {
        return reply({
          ok: false,
          error: err.message,
        });
      }

      console.error(err);
      reply({
        ok: false,
        error: "Server error",
      });
    }
  });
}
