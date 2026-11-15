import { prisma } from '../db.js';

export const ROOM_NAME_REGEX = /^[a-z0-9_-]{1,30}$/;

/**
 * Returns all rooms with member count and membership status for the requesting user.
 * The general room always includes every user and cannot be left.
 */
export async function listRooms(userId) {
  const [totalUsers, rooms] = await Promise.all([
    prisma.user.count(),
    prisma.room.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { members: true },
        },
        members: {
          where: { userId },
          select: { userId: true },
        },
      },
    }),
  ]);

  const list = [];
  let foundGeneral = false;

  for (const room of rooms) {
    if (room.name === 'general') {
      foundGeneral = true;
      list.push({
        name: 'general',
        memberCount: totalUsers,
        joined: true,
      });
    } else {
      list.push({
        name: room.name,
        memberCount: room._count.members,
        joined: room.members.length > 0,
      });
    }
  }

  if (!foundGeneral) {
    list.unshift({
      name: 'general',
      memberCount: totalUsers,
      joined: true,
    });
  }

  return list;
}
