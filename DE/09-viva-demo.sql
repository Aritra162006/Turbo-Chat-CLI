-- Turbo Chat: live demo for the DBMS viva video (Q1-Q5).
-- Run section by section in psql while recording:
--   psql "$DATABASE_URL" -X -e -f DE/09-viva-demo.sql
-- Safe to re-run. Everything that changes data is inside BEGIN ... ROLLBACK,
-- except the RoomMember rows in SETUP (ON CONFLICT DO NOTHING, so re-runs add nothing).
-- Uses names, not ids, so it works on both the DE sample data and the seed data.

\echo '=== SETUP: room memberships for the demo (05-sample-data.sql has none) ==='
INSERT INTO "Room" ("name") VALUES ('random'), ('dev') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "RoomMember" ("roomId", "userId", "role")
SELECT r."id", u."id", v.role
FROM (VALUES ('dev', 'alice', 'owner'), ('dev', 'carol', 'member'),
             ('random', 'bob', 'owner'), ('random', 'alice', 'member')) AS v(room, username, role)
JOIN "Room" r ON r."name" = v.room
JOIN "User" u ON u."username" = v.username
ON CONFLICT ("roomId", "userId") DO NOTHING;


-- =====================================================================
\echo '=== Q1a. What the data looks like: a sample of each table ==='
SELECT "id", "username", left("passwordHash", 12) || '...' AS "passwordHash", "createdAt"::date
FROM "User" ORDER BY "id" LIMIT 5;
SELECT left("token", 8) || '...' AS token, "userId" FROM "Session" LIMIT 3;
SELECT "id", "roomId", "userId", "body", "createdAt" FROM "Message" ORDER BY "createdAt" DESC LIMIT 5;
SELECT "id", "senderId", "recipientId", "body" FROM "DirectMessage" ORDER BY "id" DESC LIMIT 3;

\echo '=== Q1b. Most frequent operation 1: auth check on every REST call and socket connect ==='
\echo '(findUserByToken in services/auth.js)'
SELECT u."id", u."username"
FROM "Session" s JOIN "User" u ON u."id" = s."userId"
WHERE s."token" = (SELECT "token" FROM "Session" LIMIT 1);

\echo '=== Q1c. Most frequent operation 2: send a message (createMessage), rolled back ==='
BEGIN;
INSERT INTO "Message" ("roomId", "userId", "body")
VALUES ((SELECT "id" FROM "Room" WHERE "name" = 'general'),
        (SELECT "id" FROM "User" WHERE "username" = 'alice'), 'live demo message')
RETURNING "id", "roomId", "userId", "body";
ROLLBACK;

\echo '=== Q1d. Most frequent operation 3: history, newest 25 of a room, oldest first (getRoomHistory) ==='
SELECT * FROM (
  SELECT m."id", COALESCE(u."username", 'deleted user') AS username, m."body", m."createdAt"
  FROM "Message" m
  JOIN "Room" r ON r."id" = m."roomId"
  LEFT JOIN "User" u ON u."id" = m."userId"
  WHERE r."name" = 'general'
  ORDER BY m."createdAt" DESC
  LIMIT 25
) latest ORDER BY "createdAt";


-- =====================================================================
\echo '=== Q2a. The M:N junction table ==='
\d "RoomMember"

\echo '=== Q2b. Read across the M:N: which rooms is each user in, and with what role ==='
SELECT u."username", r."name" AS room, rm."role", rm."joinedAt"::date AS joined
FROM "User" u
JOIN "RoomMember" rm ON rm."userId" = u."id"
JOIN "Room" r        ON r."id" = rm."roomId"
ORDER BY u."username", r."name";

\echo '=== Q2c. Other direction: members per room (listRooms memberCount) ==='
SELECT r."name" AS room, COUNT(rm."userId") AS members,
       string_agg(u."username", ', ' ORDER BY u."username") AS who
FROM "Room" r
LEFT JOIN "RoomMember" rm ON rm."roomId" = r."id"
LEFT JOIN "User" u        ON u."id" = rm."userId"
GROUP BY r."id", r."name"
ORDER BY r."name";
\echo 'general shows 0 here on purpose: general has no RoomMember rows, every user is in it (see Q3).'


-- =====================================================================
\echo '=== Q3. Derived values are computed, not stored: unread count per sender for alice ==='
SELECT s."username" AS sender, COUNT(dm."id") AS unread
FROM "DirectMessage" dm
JOIN "User" s ON s."id" = dm."senderId"
LEFT JOIN "DmRead" dr ON dr."userId" = dm."recipientId" AND dr."otherUserId" = dm."senderId"
WHERE dm."recipientId" = (SELECT "id" FROM "User" WHERE "username" = 'alice')
  AND dm."createdAt" > COALESCE(dr."lastReadAt", 'epoch')
GROUP BY s."username"
ORDER BY unread DESC;


-- =====================================================================
\echo '=== Q4a. Every constraint the database enforces ==='
SELECT conrelid::regclass AS "table", conname AS "constraint",
       CASE contype WHEN 'p' THEN 'PRIMARY KEY' WHEN 'f' THEN 'FOREIGN KEY'
                    WHEN 'u' THEN 'UNIQUE' WHEN 'c' THEN 'CHECK' END AS type,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
ORDER BY 1, 3, 2;
\echo 'User.username and Room.name uniqueness are UNIQUE INDEXES (Prisma @unique), so they show in Q5a, not here.'

\echo '=== Q4b. The database rejects bad data (each statement below should FAIL) ==='
\echo '--- room name with capitals and a space (CHECK Room_name_check) ---'
INSERT INTO "Room" ("name") VALUES ('My Room!');
\echo '--- invalid role (CHECK RoomMember_role_check) ---'
INSERT INTO "RoomMember" ("roomId", "userId", "role")
VALUES ((SELECT "id" FROM "Room" WHERE "name" = 'dev'), (SELECT "id" FROM "User" WHERE "username" = 'bob'), 'admin');
\echo '--- same user joins the same room twice (composite PRIMARY KEY) ---'
INSERT INTO "RoomMember" ("roomId", "userId")
VALUES ((SELECT "id" FROM "Room" WHERE "name" = 'dev'), (SELECT "id" FROM "User" WHERE "username" = 'alice'));
\echo '--- membership in a room that does not exist (FOREIGN KEY) ---'
INSERT INTO "RoomMember" ("roomId", "userId") VALUES (99999, (SELECT "id" FROM "User" WHERE "username" = 'alice'));
\echo '--- DM to yourself (CHECK DirectMessage_sender_recipient_check) ---'
INSERT INTO "DirectMessage" ("senderId", "recipientId", "body")
SELECT "id", "id", 'note to self' FROM "User" WHERE "username" = 'alice';
\echo '--- duplicate username (UNIQUE) ---'
INSERT INTO "User" ("username", "passwordHash") VALUES ('alice', 'x');
\echo '--- message with no body (NOT NULL) ---'
INSERT INTO "Message" ("roomId", "body") VALUES ((SELECT "id" FROM "Room" WHERE "name" = 'general'), NULL);

\echo '=== Q4c. Atomicity: create a room + its owner, second insert fails, the room is NOT kept ==='
\echo '(same two inserts as prisma.$transaction in joinRoom, services/rooms.js)'
BEGIN;
INSERT INTO "Room" ("name") VALUES ('viva-demo') RETURNING "id", "name";
INSERT INTO "RoomMember" ("roomId", "userId", "role")
VALUES ((SELECT "id" FROM "Room" WHERE "name" = 'viva-demo'),
        (SELECT "id" FROM "User" WHERE "username" = 'alice'), 'boss');   -- fails the role CHECK
ROLLBACK;
SELECT COUNT(*) AS "viva-demo rooms after the failed transaction" FROM "Room" WHERE "name" = 'viva-demo';

\echo '=== Q4d. Isolation level the app runs at (Prisma does not change the Postgres default) ==='
SHOW transaction_isolation;


-- =====================================================================
\echo '=== Q5a. Every index ==='
SELECT tablename AS "table", indexname AS "index", indexdef AS definition
FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;

\echo '=== Q5b. Index evidence on bigger data (all rolled back) ==='
BEGIN;
-- 5,000 room messages, 2,000 users with one membership each, 20,000 DMs
INSERT INTO "Message" ("roomId", "userId", "body", "createdAt")
SELECT (SELECT "id" FROM "Room" WHERE "name" = 'general'), NULL, 'bulk ' || i, now() - i * interval '1 minute'
FROM generate_series(1, 5000) i;
INSERT INTO "User" ("username", "passwordHash")
SELECT 'bulk_' || i, 'x' FROM generate_series(1, 2000) i;
INSERT INTO "RoomMember" ("roomId", "userId")
SELECT (SELECT "id" FROM "Room" WHERE "name" = 'random'), "id" FROM "User" WHERE "username" LIKE 'bulk_%';
INSERT INTO "DirectMessage" ("senderId", "recipientId", "body", "createdAt")
SELECT a."id", b."id", 'bulk dm', now() - (g * interval '1 minute')
FROM generate_series(1, 20000) g
JOIN "User" a ON a."username" = 'bulk_' || (1 + g % 2000)
JOIN "User" b ON b."username" = 'bulk_' || (1 + (g * 7) % 2000)
WHERE a."id" <> b."id";
ANALYZE;

\echo '--- history: newest 25 of general -> Index Scan Backward on Message_roomId_createdAt_idx ---'
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT "id", "body", "createdAt" FROM "Message"
WHERE "roomId" = (SELECT "id" FROM "Room" WHERE "name" = 'general')
ORDER BY "createdAt" DESC LIMIT 25;

\echo '--- rooms of one user (getMyRoomNames) -> RoomMember_userId_idx ---'
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT r."name" FROM "RoomMember" rm JOIN "Room" r ON r."id" = rm."roomId"
WHERE rm."userId" = (SELECT "id" FROM "User" WHERE "username" = 'bulk_42');

\echo '--- unread DMs for one user: filters on recipientId, no index starts with it -> Seq Scan ---'
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT COUNT(*) FROM "DirectMessage"
WHERE "recipientId" = (SELECT "id" FROM "User" WHERE "username" = 'bulk_42');

\echo '--- the fix we would ship at 100x: index on (recipientId, createdAt), same query again ---'
CREATE INDEX "DirectMessage_recipientId_createdAt_idx" ON "DirectMessage"("recipientId", "createdAt");
ANALYZE "DirectMessage";
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT COUNT(*) FROM "DirectMessage"
WHERE "recipientId" = (SELECT "id" FROM "User" WHERE "username" = 'bulk_42');
ROLLBACK;

\echo '=== Row counts (nothing from the demo was kept except the RoomMember setup) ==='
SELECT (SELECT COUNT(*) FROM "User") AS users, (SELECT COUNT(*) FROM "Session") AS sessions,
       (SELECT COUNT(*) FROM "Room") AS rooms, (SELECT COUNT(*) FROM "RoomMember") AS memberships,
       (SELECT COUNT(*) FROM "Message") AS messages, (SELECT COUNT(*) FROM "DirectMessage") AS dms,
       (SELECT COUNT(*) FROM "DmRead") AS read_markers;
