import { prisma } from "../db.js";

// Convert database message into the standard DM response.
export function toDmPayload(row) {
  return {
    id: row.id,
    from: row.sender?.username ?? null,
    to: row.recipient?.username ?? null,
    body: row.body,
    createdAt: row.createdAt,
  };
}

// Send a direct message to another user.
export async function sendDm(senderId, toUsername, body) {
  if (typeof body !== "string") {
    const error = new Error("Message body is required");
    error.status = 400;
    throw error;
  }

  if (typeof toUsername !== "string" || !toUsername.trim()) {
    const error = new Error("Recipient username is required");
    error.status = 400;
    throw error;
  }

  const trimmedBody = body.trim();
  const recipientUsername = toUsername.trim();

  if (trimmedBody.length < 1 || trimmedBody.length > 500) {
    const error = new Error("Message must be between 1 and 500 characters");
    error.status = 400;
    throw error;
  }

  const recipient = await prisma.user.findUnique({
    where: { username: recipientUsername },
  });

  if (!recipient) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  if (recipient.id === senderId) {
    const error = new Error("You cannot send a DM to yourself");
    error.status = 400;
    throw error;
  }

  const dm = await prisma.directMessage.create({
    data: {
      senderId,
      recipientId: recipient.id,
      body: trimmedBody,
    },
    include: {
      sender: {
        select: { username: true },
      },
      recipient: {
        select: { username: true },
      },
    },
  });

  return {
    dm: toDmPayload(dm),
    recipientId: recipient.id,
  };
}


// List all conversations with their latest message and unread count.
export async function listConversations(userId) {
  const conversations = await prisma.$queryRaw`
    WITH conversation_messages AS (
      SELECT
        CASE
          WHEN dm."senderId" = ${userId} THEN dm."recipientId"
          ELSE dm."senderId"
        END AS "otherUserId",
        dm."id" AS "messageId"
      FROM "DirectMessage" dm
      WHERE dm."senderId" = ${userId}
         OR dm."recipientId" = ${userId}
    ),

    conversation_users AS (
      SELECT
        "otherUserId",
        MAX("messageId") AS "lastMessageId"
      FROM conversation_messages
      WHERE "otherUserId" IS NOT NULL
      GROUP BY "otherUserId"
    ),

    unread_counts AS (
      SELECT
        dm."senderId" AS "otherUserId",
        COUNT(dm."id")::int AS unread
      FROM "DirectMessage" dm
      LEFT JOIN "DmRead" dr
        ON dr."userId" = ${userId}
       AND dr."otherUserId" = dm."senderId"
      WHERE dm."recipientId" = ${userId}
        AND dm."senderId" IS NOT NULL
        AND dm."createdAt" > COALESCE(
          dr."lastReadAt",
          TIMESTAMP 'epoch'
        )
      GROUP BY dm."senderId"
    )

    SELECT
      u."username" AS username,
      last_dm."body" AS "lastMessage",
      COALESCE(unread_counts.unread, 0)::int AS unread
    FROM conversation_users cu
    JOIN "User" u
      ON u."id" = cu."otherUserId"
    JOIN "DirectMessage" last_dm
      ON last_dm."id" = cu."lastMessageId"
    LEFT JOIN unread_counts
      ON unread_counts."otherUserId" = u."id"
    ORDER BY last_dm."id" DESC
  `;

  return conversations;
}


// Get messages from a conversation with pagination.
export async function getConversation(userId, username, before) {
  if (before !== undefined && (!Number.isInteger(before) || before <= 0)) {
    const error = new Error("Invalid before message ID");
    error.status = 400;
    throw error;
  }

  if (typeof username !== "string" || !username.trim()) {
    const error = new Error("Username is required");
    error.status = 400;
    throw error;
  }

  const otherUser = await prisma.user.findUnique({
    where: { username: username.trim() },
  });

  if (!otherUser) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  if (otherUser.id === userId) {
    const error = new Error("You cannot open a DM conversation with yourself");
    error.status = 400;
    throw error;
  }

  const messages = await prisma.directMessage.findMany({
    where: {
      OR: [
        {
          senderId: userId,
          recipientId: otherUser.id,
        },
        {
          senderId: otherUser.id,
          recipientId: userId,
        },
      ],
      ...(before !== undefined ? { id: { lt: before } } : {}),
    },
    orderBy: {
      id: "desc",
    },
    take: 25,
    include: {
      sender: {
        select: { username: true },
      },
      recipient: {
        select: { username: true },
      },
    },
  });

  return messages.reverse().map(toDmPayload);
}


// Mark a conversation as read.
export async function markRead(userId, username) {
  if (typeof username !== "string" || !username.trim()) {
    const error = new Error("Username is required");
    error.status = 400;
    throw error;
  }

  const otherUser = await prisma.user.findUnique({
    where: { username: username.trim() },
  });

  if (!otherUser) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  if (otherUser.id === userId) {
    const error = new Error("You cannot mark your own conversation as read");
    error.status = 400;
    throw error;
  }

  const now = new Date();

  return prisma.dmRead.upsert({
    where: {
      userId_otherUserId: {
        userId,
        otherUserId: otherUser.id,
      },
    },
    create: {
      userId,
      otherUserId: otherUser.id,
      lastReadAt: now,
    },
    update: {
      lastReadAt: now,
    },
  });
}