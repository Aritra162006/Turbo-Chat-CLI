import { prisma } from '../db.js';

const HISTORY_SIZE = 25;
const MAX_BODY = 500;
const include = { user: { select: { username: true } }, room: { select: { name: true } } };

// The one message shape used everywhere (REST history and the live message:new event).
function toPayload(m) {
  return {
    id: m.id,
    room: m.room.name,
    username: m.user?.username ?? null,
    body: m.body,
    createdAt: m.createdAt,
  };
}

// Gets the newest 25 messages of the general room, then flips them so the oldest comes first.
export async function getGeneralHistory() {
  const rows = await prisma.message.findMany({
    where: { room: { name: 'general' } },
    orderBy: { id: 'desc' },
    take: HISTORY_SIZE,
    include,
  });
  return rows.reverse().map(toPayload);
}

// Checks the body (a string, 1-500 characters after trimming), saves it, and returns the payload.
export async function createMessage(userId, roomName, body) {
  const text = typeof body === 'string' ? body.trim() : '';
  if (!text || text.length > MAX_BODY) {
    const e = new Error(`Message must be 1-${MAX_BODY} characters`);
    e.status = 400;
    throw e;
  }
  const row = await prisma.message.create({
    data: { body: text, user: { connect: { id: userId } }, room: { connect: { name: roomName } } },
    include,
  });
  return toPayload(row);
}
