import { prisma } from '../db.js';

const HISTORY_SIZE = 25;

// Gets the newest 25 messages of the general room, then flips them so the oldest comes first.
export async function getGeneralHistory() {
  const rows = await prisma.message.findMany({
    where: { room: { name: 'general' } },
    orderBy: { id: 'desc' },
    take: HISTORY_SIZE,
    include: { user: { select: { username: true } } },
  });
  return rows.reverse().map((m) => ({
    id: m.id,
    username: m.user?.username ?? null,
    body: m.body,
    createdAt: m.createdAt,
  }));
}
