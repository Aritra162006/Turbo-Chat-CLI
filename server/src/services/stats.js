import { prisma } from "../db.js";

// Get the 5 most active rooms based on messages sent in the last 7 days.
export async function mostActiveRooms() {
  const rooms = await prisma.$queryRaw`
    SELECT
      r."name" AS room,
      COUNT(m."id")::int AS "messageCount"
    FROM "Room" r
    JOIN "Message" m ON m."roomId" = r."id"
    WHERE m."createdAt" > (now() AT TIME ZONE 'UTC') - interval '7 days'
    GROUP BY r."id"
    ORDER BY "messageCount" DESC
    LIMIT 5
  `;

  return rooms;
}
