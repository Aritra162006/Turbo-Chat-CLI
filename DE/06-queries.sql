-- Turbo Chat: project queries. Each one is what a real app feature does.
-- Run on the sample data (05-sample-data.sql):
--   psql "$DATABASE_URL" -X -e -f DE/06-queries.sql
-- Output of a real run: 07-query-outputs.txt
-- Table and column names are camelCase, so they need double quotes.

\echo '=== Q1. Signup: create a user and their first session in one statement (INSERT ... RETURNING) ==='
WITH new_user AS (
  INSERT INTO "User" ("username", "passwordHash")
  VALUES ('frank', '$2b$10$DmLqAFsM76lz0Xu43PTBK.BoBsFiHQStxW10U5yuNCRu55AR4/nfm')
  RETURNING "id", "username"
)
INSERT INTO "Session" ("token", "userId")
SELECT gen_random_uuid()::text, "id" FROM new_user
RETURNING "userId", length("token") AS token_length;

\echo '=== Q2. Login check: which user owns this session token? (JOIN) ==='
SELECT u."id", u."username"
FROM "Session" s
JOIN "User" u ON u."id" = s."userId"
WHERE s."token" = (SELECT "token" FROM "Session" WHERE "userId" = 2 LIMIT 1);

\echo '=== Q3. Send a message to general (INSERT with room looked up by name) ==='
INSERT INTO "Message" ("roomId", "userId", "body")
VALUES ((SELECT "id" FROM "Room" WHERE "name" = 'general'), 6, 'Hello from frank')
RETURNING "id", "roomId", "userId", "body";

\echo '=== Q4. Chat history: newest 5 messages of general, shown oldest first (JOIN, ORDER BY, LIMIT, subquery) ==='
SELECT * FROM (
  SELECT m."id", COALESCE(u."username", 'deleted user') AS username, m."body", m."createdAt"
  FROM "Message" m
  JOIN "Room" r ON r."id" = m."roomId"
  LEFT JOIN "User" u ON u."id" = m."userId"
  WHERE r."name" = 'general'
  ORDER BY m."createdAt" DESC
  LIMIT 5
) latest
ORDER BY "createdAt" ASC;

\echo '=== Q5. Most active rooms in the last 7 days (JOIN, COUNT, GROUP BY, ORDER BY) ==='
SELECT r."name" AS room, COUNT(m."id")::int AS message_count
FROM "Room" r
JOIN "Message" m ON m."roomId" = r."id"
WHERE m."createdAt" > now() - interval '7 days'
GROUP BY r."id", r."name"
ORDER BY message_count DESC
LIMIT 5;

\echo '=== Q6. Active users: sent at least 3 room messages in the last 7 days (GROUP BY + HAVING) ==='
SELECT u."username", COUNT(*) AS messages, MAX(m."createdAt") AS last_message_at
FROM "Message" m
JOIN "User" u ON u."id" = m."userId"
WHERE m."createdAt" > now() - interval '7 days'
GROUP BY u."username"
HAVING COUNT(*) >= 3
ORDER BY messages DESC;

\echo '=== Q7. DM history between alice and bob, newest 25 (OR filter, ORDER BY, LIMIT) ==='
SELECT dm."id", s."username" AS "from", r."username" AS "to", dm."body"
FROM "DirectMessage" dm
LEFT JOIN "User" s ON s."id" = dm."senderId"
LEFT JOIN "User" r ON r."id" = dm."recipientId"
WHERE (dm."senderId" = 1 AND dm."recipientId" = 2)
   OR (dm."senderId" = 2 AND dm."recipientId" = 1)
ORDER BY dm."id" DESC
LIMIT 25;

\echo '=== Q8. Unread DM count per sender for alice (LEFT JOIN, COALESCE, COUNT, GROUP BY) ==='
SELECT s."username" AS sender, COUNT(dm."id") AS unread
FROM "DirectMessage" dm
JOIN "User" s ON s."id" = dm."senderId"
LEFT JOIN "DmRead" dr ON dr."userId" = 1 AND dr."otherUserId" = dm."senderId"
WHERE dm."recipientId" = 1
  AND dm."createdAt" > COALESCE(dr."lastReadAt", 'epoch')
GROUP BY s."username"
ORDER BY unread DESC;

\echo '=== Q9. alice opens her chat with carol: mark it read (UPDATE via INSERT ... ON CONFLICT) ==='
INSERT INTO "DmRead" ("userId", "otherUserId", "lastReadAt")
VALUES (1, 3, now())
ON CONFLICT ("userId", "otherUserId") DO UPDATE SET "lastReadAt" = EXCLUDED."lastReadAt"
RETURNING "userId", "otherUserId";

\echo '--- alice reads bob again: the row already exists, so this time it is an UPDATE ---'
UPDATE "DmRead" SET "lastReadAt" = now()
WHERE "userId" = 1 AND "otherUserId" = 2
RETURNING "userId", "otherUserId";

\echo '--- Q8 again: carol no longer shows as unread ---'
SELECT s."username" AS sender, COUNT(dm."id") AS unread
FROM "DirectMessage" dm
JOIN "User" s ON s."id" = dm."senderId"
LEFT JOIN "DmRead" dr ON dr."userId" = 1 AND dr."otherUserId" = dm."senderId"
WHERE dm."recipientId" = 1
  AND dm."createdAt" > COALESCE(dr."lastReadAt", 'epoch')
GROUP BY s."username";

\echo '=== Q10. Users with no DM conversations yet, to suggest people to talk to (NOT EXISTS subquery) ==='
SELECT u."username", u."createdAt"::date AS joined
FROM "User" u
WHERE NOT EXISTS (
  SELECT 1 FROM "DirectMessage" dm
  WHERE dm."senderId" = u."id" OR dm."recipientId" = u."id"
)
ORDER BY u."username";

\echo '=== Q11. Users with more open sessions than average (subquery in HAVING) ==='
SELECT u."username", COUNT(s."token") AS open_sessions
FROM "User" u
JOIN "Session" s ON s."userId" = u."id"
GROUP BY u."username"
HAVING COUNT(s."token") > (
  SELECT AVG(c) FROM (SELECT COUNT(*) AS c FROM "Session" GROUP BY "userId") per_user
);

\echo '=== Q12. Logout: delete one session (DELETE ... RETURNING) ==='
DELETE FROM "Session"
WHERE "token" = (SELECT "token" FROM "Session" WHERE "userId" = 1 LIMIT 1)
RETURNING "userId";
SELECT COUNT(*) AS alice_sessions_left FROM "Session" WHERE "userId" = 1;

\echo '=== Q13. Deleting a user: sessions cascade, messages stay as "deleted user" (inside a transaction, rolled back) ==='
BEGIN;
DELETE FROM "User" WHERE "username" = 'dave' RETURNING "id";
SELECT COUNT(*) AS dave_sessions FROM "Session" WHERE "userId" = 4;
SELECT COALESCE(u."username", 'deleted user') AS username, m."body"
FROM "Message" m LEFT JOIN "User" u ON u."id" = m."userId"
WHERE m."body" IN ('Working on it', 'Yes!');
ROLLBACK;

\echo '=== Q14. Integrity: bad data is refused by the database (each statement should fail) ==='
\echo '--- duplicate username (UNIQUE) ---'
INSERT INTO "User" ("username", "passwordHash") VALUES ('alice', 'x');
\echo '--- DM to yourself (CHECK) ---'
INSERT INTO "DirectMessage" ("senderId", "recipientId", "body") VALUES (1, 1, 'note to self');
\echo '--- message in a room that does not exist (FOREIGN KEY) ---'
INSERT INTO "Message" ("roomId", "userId", "body") VALUES (999, 1, 'hello?');
\echo '--- message with no body (NOT NULL) ---'
INSERT INTO "Message" ("roomId", "userId", "body") VALUES (1, 1, NULL);
\echo '--- second read marker for the same pair (composite PRIMARY KEY) ---'
INSERT INTO "DmRead" ("userId", "otherUserId") VALUES (1, 2);

\echo '=== Q15. Index check: chat history query on 5,000 extra messages (EXPLAIN ANALYZE, rolled back) ==='
\echo 'On 16 rows Postgres just reads the whole table, so we add 5,000 rows first.'
BEGIN;
INSERT INTO "Message" ("roomId", "userId", "body", "createdAt")
SELECT 1, 1 + (i % 5), 'bulk message ' || i, now() - i * interval '1 minute'
FROM generate_series(1, 5000) AS i;
ANALYZE "Message";
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT m."id", m."body", m."createdAt"
FROM "Message" m
WHERE m."roomId" = 1
ORDER BY m."createdAt" DESC
LIMIT 25;
ROLLBACK;

\echo '=== Final row counts ==='
SELECT (SELECT COUNT(*) FROM "User") AS users,
       (SELECT COUNT(*) FROM "Session") AS sessions,
       (SELECT COUNT(*) FROM "Room") AS rooms,
       (SELECT COUNT(*) FROM "Message") AS messages,
       (SELECT COUNT(*) FROM "DirectMessage") AS dms,
       (SELECT COUNT(*) FROM "DmRead") AS read_markers;
