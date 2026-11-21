# Database and backend integration

## How the backend talks to PostgreSQL

```
terminal client ──HTTP (REST) / socket.io──▶ Express + socket.io server ──Prisma Client──▶ PostgreSQL
                                              server/src/services/*.js     (@prisma/adapter-pg, uses the pg driver)
```

1. **Connection:** [server/src/db.js](../server/src/db.js) creates one `PrismaClient` with the `PrismaPg` adapter. The adapter uses the `pg` driver and its connection pool. The connection string comes from `DATABASE_URL` in `server/.env`.
2. **Schema:** [server/prisma/schema.prisma](../server/prisma/schema.prisma) (plus `prisma/models/dms.prisma`) describes the tables. `npx prisma migrate dev` turns changes into SQL migration files in `server/prisma/migrations/`, and `npx prisma migrate deploy` applies them.
3. **Queries:** routes and socket handlers never touch SQL directly. They call functions in `server/src/services/`, which use Prisma Client. Two queries are written as raw SQL with Prisma's tagged `$queryRaw` (values are sent as parameters, so they are safe from SQL injection).
4. **Errors:** a database error with a known meaning is turned into an HTTP status (for example Prisma error `P2002` = unique violation → `409 Username already exists`). Anything else becomes `500 Server error`, and the details go to the server log only.

## Every feature and the SQL behind it

| Feature (how the user triggers it) | Code | Prisma call | SQL it runs (same idea as in `06-queries.sql`) | Op |
|---|---|---|---|---|
| Sign up (`POST /api/signup`) | `services/auth.js` `signup` | `user.create` with nested `sessions: { create: {} }` | `INSERT INTO "User"` + `INSERT INTO "Session"` in one transaction (Q1) | C |
| Log in (`POST /api/login`) | `services/auth.js` `login` | `user.findUnique`, `session.create` | `SELECT ... WHERE username = $1`, `INSERT INTO "Session"` | R, C |
| Every request / socket connect | `middleware/auth.js`, `socket.js` → `findUserByToken` | `session.findUnique` with `include: user` | `SELECT` Session `JOIN` User by token (Q2) | R |
| Log out (`POST /api/logout`) | `services/auth.js` `logout` | `session.delete` | `DELETE FROM "Session" WHERE token = $1` (Q12) | D |
| Send a room message (`message:send` socket event) | `services/messages.js` `createMessage` | `message.create` with `room: { connect: { name } }` | `INSERT INTO "Message"` with room looked up by name (Q3) | C |
| Chat history on login (`GET /api/rooms/general/messages`) | `services/messages.js` `getGeneralHistory` | `message.findMany` `orderBy createdAt desc, take 25` | newest 25 by `createdAt`, uses the `(roomId, createdAt)` index (Q4, Q15) | R |
| Send a DM (`dm:send` socket event) | `services/dms.js` `sendDm` | `user.findUnique`, `directMessage.create` | `INSERT INTO "DirectMessage"` | C |
| DM history (`GET /api/dms/:username/messages`) | `services/dms.js` `getConversation` | `directMessage.findMany` with `OR`, `id < before`, `take 25` | Q7 | R |
| Conversation list with unread counts (`GET /api/dms`) | `services/dms.js` `listConversations` | `$queryRaw` (CTEs, `LEFT JOIN`, `COUNT`, `GROUP BY`) | Q8 | R |
| Mark a DM chat as read (`POST /api/dms/:username/read`) | `services/dms.js` `markRead` | `dmRead.upsert` | `INSERT ... ON CONFLICT DO UPDATE` (Q9) | U |
| Most active rooms (`GET /api/stats/rooms`) | `services/stats.js` `mostActiveRooms` | `$queryRaw` | `JOIN`, `COUNT`, `GROUP BY`, `ORDER BY`, `LIMIT 5` (Q5) | R |

C = create, R = read, U = update, D = delete.

## Evidence: data sent through the app shows up in the database

Run on 2026-11-18 against a fresh database (`migrate deploy`, then `05-sample-data.sql` and `06-queries.sql`). The server was started with `node src/server.js` on port 3100, and the project's own test scripts were run against it.

### 1. Through the app

```
$ node scripts/chat-test.js grace "Hi, sent from the app"     # signs up 'grace' over REST, sends over socket.io
[general] grace: Hi, sent from the app
ack: {
  ok: true,
  message: {
    id: 5019,
    room: 'general',
    username: 'grace',
    body: 'Hi, sent from the app',
    createdAt: '2026-11-18T11:18:47.470Z'
  }
}

$ curl GET /api/rooms/general/messages   (as grace, last 3 shown)
carol | Welcome eve
grace | Hi, sent from the app
frank | Hello from frank

$ curl POST /api/signup  {"username":"alice", ...}      # alice already exists
{"error":"Username already exists. Please check or enter something else."} (HTTP 409)

$ curl POST /api/signup  {"username":"a!", ...}
{"error":"Username must be 3-20 letters, numbers or _"} (HTTP 400)

$ curl GET /api/stats/rooms
[{"room":"general","messageCount":10},{"room":"random","messageCount":3},{"room":"dev","messageCount":2}]

$ curl POST /api/logout
HTTP 204

$ bash scripts/check-dms.sh
PASS: Both users created
PASS: GET /api/dms returned a JSON array
PASS: GET conversation messages returned a JSON array
PASS: POST mark-read returned HTTP 204
PASS: GET stats returned a JSON array
PASS: Unauthenticated request rejected with HTTP 401
ALL HTTP TESTS PASSED!

$ node scripts/dms-test.js
PASS: A's two sockets and B received dm:new
PASS: recipientOnline is true
PASS: Self-DM rejected
PASS: User A unread count = 1
PASS: First five messages accepted
PASS: Sixth message rejected
ALL DM SOCKET TESTS PASSED!
```

### 2. The same data, read straight from PostgreSQL with psql

```
SELECT "id", "username", left("passwordHash", 7) AS hash_start FROM "User" WHERE "username" = 'grace';
 id | username | hash_start
----+----------+------------
  8 | grace    | $2b$10$          <- stored as a bcrypt hash, not the password
(1 row)

SELECT COUNT(*) AS grace_sessions FROM "Session" s JOIN "User" u ON u."id" = s."userId" WHERE u."username" = 'grace';
 grace_sessions
----------------
              1                   <- signup + login made 2 sessions, logout deleted 1
(1 row)

SELECT m."id", r."name" AS room, u."username", m."body" FROM "Message" m
JOIN "Room" r ON r."id" = m."roomId" JOIN "User" u ON u."id" = m."userId" WHERE u."username" = 'grace';
  id  |  room   | username |         body
------+---------+----------+-----------------------
 5019 | general | grace    | Hi, sent from the app
(1 row)

SELECT s."username" AS "from", r."username" AS "to", dm."body" FROM "DirectMessage" dm
JOIN "User" s ON s."id" = dm."senderId" JOIN "User" r ON r."id" = dm."recipientId" ORDER BY dm."id" DESC LIMIT 3;
      from       |       to        |       body
-----------------+-----------------+-------------------
 testcc30a56fa91 | testac30a56fa91 | Rate limit test 5      <- the 6th, rate-limited DM was never saved
 testcc30a56fa91 | testac30a56fa91 | Rate limit test 4
 testcc30a56fa91 | testac30a56fa91 | Rate limit test 3
(3 rows)
```

The message id is 5019, not 17, because query Q15 inserted 5,000 rows inside a transaction and rolled it back. A rollback removes the rows, but PostgreSQL never gives sequence numbers back. Gaps in ids are normal and harmless.

## How to repeat this

```bash
createdb turbochat_de
cd server
DATABASE_URL=postgresql://<user>:<pass>@localhost:5432/turbochat_de npx prisma migrate deploy
psql postgresql://<user>:<pass>@localhost:5432/turbochat_de -f ../DE/05-sample-data.sql
psql postgresql://<user>:<pass>@localhost:5432/turbochat_de -X -e -f ../DE/06-queries.sql
DATABASE_URL=postgresql://<user>:<pass>@localhost:5432/turbochat_de PORT=3100 node src/server.js
```

Then, in another terminal, from `server/`:

```bash
URL=http://localhost:3100 node scripts/chat-test.js grace "Hi, sent from the app"
```
