# Turbo Chat: Data Engineering (DE)

Turbo Chat is a terminal chat app. Users sign up, chat live in rooms (the `general` room), send private direct messages (DMs) with unread counts, and see which rooms are most active. The backend is Node.js (Express + socket.io). The database is **PostgreSQL**, accessed through **Prisma 7**.

## What is in this folder

| # | Deliverable | File |
|---|---|---|
| 1 | Database selection and justification | this file, [below](#1-database-selection-and-justification) |
| 2 | ER diagram | [02-er-diagram.md](02-er-diagram.md) |
| 3 | Normalization (1NF, 2NF, 3NF) | [03-normalization.md](03-normalization.md) |
| 4 | Final database schema | [04-schema.sql](04-schema.sql) |
| 5 | Sample records | [05-sample-data.sql](05-sample-data.sql) |
| 6 | 15 project queries, with real outputs | [06-queries.sql](06-queries.sql), [07-query-outputs.txt](07-query-outputs.txt) |
| 7 | Database and backend integration evidence | [08-integration.md](08-integration.md) |
| 8 | Architecture, integrity and performance decisions | this file, [below](#architecture-and-implementation-decisions) |

The app's real schema lives in [server/prisma/schema.prisma](../server/prisma/schema.prisma) and [server/prisma/models/dms.prisma](../server/prisma/models/dms.prisma), with the migrations in [server/prisma/migrations/](../server/prisma/migrations/). `04-schema.sql` is the same schema written out by hand, and it was checked against a migrated database: the columns, constraints and indexes are identical.

## 1. Database selection and justification

**Chosen: PostgreSQL.**

What we store:

- **Users and sessions:** each session belongs to exactly one user.
- **Rooms and room messages:** each message belongs to one room and one sender.
- **Direct messages and read markers:** each DM links two users. Each read marker links a pair of users.

The data is **highly relational and has a fixed shape**. Every message has the same four fields, and almost every feature is a join: history needs message + user + room, unread counts need DMs + read markers + users. That is what a relational database is built for.

Why PostgreSQL fits better than MongoDB here:

| Need in Turbo Chat | PostgreSQL | MongoDB |
|---|---|---|
| Usernames must be unique | `UNIQUE` index, enforced by the database | possible with a unique index |
| A message must belong to a real room, and a session to a real user | **foreign keys**, enforced on every insert | no foreign keys; the app has to check |
| Delete a user: end their sessions, keep their messages as "deleted user" | `ON DELETE CASCADE` / `ON DELETE SET NULL`, automatic | manual cleanup code |
| Nobody can DM themselves | `CHECK (senderId <> recipientId)` | schema validation, weaker |
| Signup must create the user **and** a session, or neither | transactions (ACID) | supported, but not the default way of working |
| Unread counts, most active rooms | `JOIN`, `GROUP BY`, `COUNT` in one query | aggregation pipeline with `$lookup` |
| Messages grow without limit | embedding them in a room document would hit the 16 MB document limit, so they would end up in their own collection with references anyway | |

The project's required stack (Prisma + PostgreSQL) also matches this choice.

## Architecture and implementation decisions

### Tables

`User`, `Session`, `Room`, `Message`, `DirectMessage`, `DmRead`. See the [ER diagram](02-er-diagram.md) for the relationships.

### Key decisions

1. **Sessions in a table, not JWTs.** Logging out deletes the `Session` row, so the token stops working at once. A JWT stays valid until it expires.
2. **`Message.userId` is nullable with `ON DELETE SET NULL`.** If an account is deleted, the room history stays readable, shown as "deleted user". `Session` uses `CASCADE` instead, because a session without a user is useless.
3. **DMs in their own table**, not mixed into `Message`, so neither table needs "either roomId or recipientId" logic.
4. **Unread counts are computed, not stored**, from `DirectMessage.createdAt > DmRead.lastReadAt`. There is no counter that can go out of sync.
5. **The `general` room is inserted by the first migration**, so it exists in every database, even without seed data.
6. **Prisma for everyday queries, raw SQL where it is clearer.** Simple create, find and delete calls use Prisma Client. The unread-count list and the most-active-rooms report use `$queryRaw` (parameterized SQL), because they are multi-table aggregates.
7. **Migrations are in git**, so `npx prisma migrate deploy` builds the exact same schema on any machine.

### Data integrity (constraints and validation)

The database and the API check different things:

| Problem | Database guard | API guard (before the database) |
|---|---|---|
| Duplicate username | `UNIQUE` index on `User.username` | Prisma error `P2002` → `409 Username already exists` |
| Invalid username | none | regex `^\w{3,20}$` → `400` |
| Weak or missing password | `passwordHash NOT NULL` | at least 6 characters → `400`; stored as a bcrypt hash |
| Empty or huge message | `body NOT NULL` | trimmed, must be 1-500 characters → `400` |
| Message to a room that doesn't exist | foreign key `Message.roomId` | the socket must be in that room |
| DM to yourself | `CHECK ("senderId" <> "recipientId")` | `400 You cannot send a DM to yourself` |
| DM to an unknown user | foreign key `DirectMessage.recipientId` | `404 User not found` |
| Two read markers for the same chat | composite primary key `(userId, otherUserId)` | `upsert` updates the row that is already there |
| Fake or expired login | `Session.token` primary key lookup | `401 Not logged in` |
| Seed script run twice | `UNIQUE` username | `createMany({ skipDuplicates: true })` |

Each database guard is shown failing on purpose in query **Q14** of [07-query-outputs.txt](07-query-outputs.txt). The API guards are shown in [08-integration.md](08-integration.md).

### Indexing

**Indexes in use:**

| Index | Used by | Why |
|---|---|---|
| `Message (roomId, createdAt)` | chat history: newest 25 messages of a room | Postgres reads the index backwards and stops after 25 rows: no full scan, no sort. Proven with `EXPLAIN ANALYZE` in **Q15** (`Index Scan Backward using "Message_roomId_createdAt_idx"`, 4 buffer hits with 5,000+ rows) and in [docs/evidence/explain-messages.txt](../docs/evidence/explain-messages.txt) |
| `DirectMessage (senderId, recipientId, id)` | DM history between two users, paged with `id < before` | matches the `WHERE` and the `ORDER BY id` |
| `User.username` unique | login and every "find user by name" | also enforces uniqueness |
| `Room.name` unique | sending to a room by name | also enforces uniqueness |
| `Session.token` primary key | the auth check on every request and socket connection | |
| `DmRead (userId, otherUserId)` primary key | unread count join | |

**Index opportunities we found but have not added yet** (PostgreSQL does not index foreign keys automatically):

- `Session (userId)`: deleting a user has to find their sessions. Today that is a full scan of `Session`.
- `DirectMessage (recipientId, createdAt)`: the unread count filters by recipient. The existing index starts with `senderId`, so it cannot help.
- `Message (createdAt)`: the most-active-rooms report filters on the last 7 days. With little data, Postgres uses a sequential scan, which is fine for now (see `docs/schema.md`).

We left them out because the current data is small and every index slows down inserts a little. Each one is a single `@@index` line in the Prisma schema plus a migration once the data grows.

### Growth and scale

- **History is always paged.** Every history query has `LIMIT 25` and uses an index, so it costs the same with 5,000 messages or 5 million.
- **Small rows.** The foreign keys are integers, and usernames are stored once in `User`, not copied into every message.
- **Connection pooling.** The `pg` driver behind Prisma keeps a pool of connections, so the database is not reconnected on every request.
- **Next steps if usage grows:** add the indexes above. Partition `Message` by month so old messages can be archived. Delete sessions unused for N days (they have no expiry today). Move the stats query to a read replica.

### Known limits (honest list)

- The username length (3-20) and message length (1-500) are checked only in the API. The columns are plain `TEXT`. A `CHECK (char_length(body) BETWEEN 1 AND 500)` would make the database enforce them too.
- Sessions never expire.
- Only the `general` room is used by the app today. `random` and `dev` in the sample data exist to show the multi-room queries (Q5).
