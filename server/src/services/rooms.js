import { prisma } from '../db.js';
import { toPayload, include } from './messages.js';

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

/**
 * Join an existing room or create a new room with the requesting user as owner.
 * Joining general creates no RoomMember record and always succeeds.
 * Duplicate joins are idempotent and return isNew: false.
 */
export async function joinRoom(userId, name) {
  if (typeof name !== 'string' || !ROOM_NAME_REGEX.test(name)) {
    const err = new Error('Invalid room name');
    err.status = 400;
    throw err;
  }

  if (name === 'general') {
    const totalUsers = await prisma.user.count();
    return { name: 'general', memberCount: totalUsers, isNew: false };
  }

  let room = await prisma.room.findUnique({ where: { name } });

  if (!room) {
    try {
      await prisma.$transaction(async (tx) => {
        const newRoom = await tx.room.create({
          data: { name },
        });
        await tx.roomMember.create({
          data: {
            roomId: newRoom.id,
            userId,
            role: 'owner',
          },
        });
      });
      return { name, memberCount: 1, isNew: true };
    } catch (err) {
      if (err.code === 'P2002') {
        // Handled concurrent creation
        room = await prisma.room.findUnique({ where: { name } });
      } else {
        throw err;
      }
    }
  }

  let isNew = false;
  const existing = await prisma.roomMember.findUnique({
    where: {
      roomId_userId: {
        roomId: room.id,
        userId,
      },
    },
  });

  if (!existing) {
    try {
      await prisma.roomMember.create({
        data: {
          roomId: room.id,
          userId,
          role: 'member',
        },
      });
      isNew = true;
    } catch (err) {
      if (err.code === 'P2002') {
        isNew = false;
      } else {
        throw err;
      }
    }
  }

  const memberCount = await prisma.roomMember.count({
    where: { roomId: room.id },
  });

  return { name, memberCount, isNew };
}

/**
 * Leave a room. Leaving general is rejected with 400.
 * Non-members receive a 404.
 */
export async function leaveRoom(userId, name) {
  if (name === 'general') {
    const err = new Error('Cannot leave the general room');
    err.status = 400;
    throw err;
  }

  const room = await prisma.room.findUnique({ where: { name } });
  if (!room) {
    const err = new Error('Room not found');
    err.status = 404;
    throw err;
  }

  const member = await prisma.roomMember.findUnique({
    where: {
      roomId_userId: {
        roomId: room.id,
        userId,
      },
    },
  });

  if (!member) {
    const err = new Error('Not a member of this room');
    err.status = 404;
    throw err;
  }

  await prisma.roomMember.delete({
    where: {
      roomId_userId: {
        roomId: room.id,
        userId,
      },
    },
  });

  return { ok: true };
}

const HISTORY_SIZE = 25;

/**
 * Returns the last 25 messages of a room, oldest first.
 * Rejects non-members with 403 and unknown rooms with 404.
 * General room is accessible to all users.
 */
export async function getRoomHistory(userId, name) {
  const room = await prisma.room.findUnique({ where: { name } });
  if (!room) {
    const err = new Error('Room not found');
    err.status = 404;
    throw err;
  }

  if (name !== 'general') {
    const member = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId,
        },
      },
    });

    if (!member) {
      const err = new Error('Forbidden: you are not a member of this room');
      err.status = 403;
      throw err;
    }
  }

  const rows = await prisma.message.findMany({
    where: { roomId: room.id },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_SIZE,
    include,
  });

  return rows.reverse().map(toPayload);
}

/**
 * Returns an array of room names that the user belongs to.
 * Used to restore room subscriptions upon socket reconnect.
 */
export async function getMyRoomNames(userId) {
  const memberships = await prisma.roomMember.findMany({
    where: { userId },
    include: {
      room: {
        select: { name: true },
      },
    },
    orderBy: { joinedAt: 'asc' },
  });

  return memberships.map((m) => m.room.name);
}


