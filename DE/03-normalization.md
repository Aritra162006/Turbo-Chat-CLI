# Normalization (UNF → 1NF → 2NF → 3NF)

We start from the simplest way to store a chat: one big "chat log" sheet, like an export, and normalize it step by step until we reach the tables in [04-schema.sql](04-schema.sql).

## Step 0: Unnormalized form (UNF)

One row per message, with everything about the sender and room copied in:

| msgId | roomName | roomCreatedAt | username | passwordHash | userJoinedAt | sessionTokens | body | sentAt |
|---|---|---|---|---|---|---|---|---|
| 1 | general | 2026-11-02 | alice | $2b$10$Dm... | 2026-10-19 | `t1, t2` | Hi everyone! | 11-12 16:48 |
| 2 | general | 2026-11-02 | bob | $2b$10$Dm... | 2026-10-20 | `t3` | Hey alice | 11-12 16:49 |
| 9 | random | 2026-11-02 | bob | $2b$10$Dm... | 2026-10-20 | `t3` | Anyone watching...? | 11-14 16:48 |
| 12 | dev | 2026-11-02 | alice | $2b$10$Dm... | 2026-10-19 | `t1, t2` | Pushed the fix | 11-16 16:48 |

### Problems (anomalies)

- **Redundancy:** alice's password hash, join date and tokens are repeated on every message she sends. The room's creation date is repeated on every message in it.
- **Update anomaly:** when alice changes her password, every one of her message rows must change. Miss one and the data disagrees with itself.
- **Insert anomaly:** a new user who has not sent a message yet cannot be stored. Nor can a new empty room.
- **Delete anomaly:** delete the only message in `random` and the room itself disappears. Delete eve's only message and her account is gone.
- **Not atomic:** `sessionTokens` holds a list (`t1, t2`), so "who owns token t2?" needs string searching.

## Step 1: First Normal Form (1NF)

**Rule:** every cell holds one value, and there are no repeating groups.

`sessionTokens` is a repeating group. Giving each token its own row makes every cell atomic:

| msgId | token | roomName | roomCreatedAt | username | passwordHash | userJoinedAt | body | sentAt |
|---|---|---|---|---|---|---|---|---|
| 1 | t1 | general | ... | alice | ... | ... | Hi everyone! | ... |
| 1 | t2 | general | ... | alice | ... | ... | Hi everyone! | ... |
| 2 | t3 | general | ... | bob | ... | ... | Hey alice | ... |

Primary key is now **(msgId, token)**. It is in 1NF, but the message body is now stored twice for alice (once per token), which is worse redundancy.

## Step 2: Second Normal Form (2NF)

**Rule:** 1NF, and every non-key column depends on the **whole** primary key, not just part of it.

Functional dependencies in the 1NF table:

- `msgId → roomName, roomCreatedAt, username, passwordHash, userJoinedAt, body, sentAt` (only half the key)
- `token → username` (only the other half)

Both are **partial dependencies**, so we split by what each column really depends on:

- **Message**(<u>msgId</u>, roomName, roomCreatedAt, username, passwordHash, userJoinedAt, body, sentAt)
- **Session**(<u>token</u>, username)

Now both tables have a single-column key, so there can be no partial dependency. Tokens are no longer tied to messages, which matches reality: a session has nothing to do with any particular message.

## Step 3: Third Normal Form (3NF)

**Rule:** 2NF, and no non-key column depends on another non-key column (no **transitive** dependency).

In `Message`:

- `msgId → username → passwordHash, userJoinedAt`: the password belongs to the user, not to the message.
- `msgId → roomName → roomCreatedAt`: the creation date belongs to the room.

Move each group to its own table and keep only a reference in `Message`. We also swap the names for integer surrogate keys (`id`), so a rename never touches messages and foreign keys stay small:

- **User**(<u>id</u>, username UNIQUE, passwordHash, createdAt)
- **Room**(<u>id</u>, name UNIQUE, createdAt)
- **Message**(<u>id</u>, roomId → Room, userId → User, body, createdAt)
- **Session**(<u>token</u>, userId → User, createdAt)

## The DM tables

These were designed normalized from the start, and they are checked the same way:

- **DirectMessage**(<u>id</u>, senderId → User, recipientId → User, body, createdAt). The only dependency is `id → everything`. Usernames are not copied in; they are joined from `User` when needed.
- **DmRead**(<u>userId, otherUserId</u>, lastReadAt). `lastReadAt` depends on the whole pair (alice's read time for bob is different from her read time for carol), so it is 2NF. There is one non-key column, so there is no transitive dependency.
- **The unread count is not a column.** It can be computed from the two tables above. Storing it would be a derived value: an update anomaly waiting to happen.

## Final functional dependencies

| Table | Functional dependencies |
|---|---|
| User | `id → username, passwordHash, createdAt`; `username → id` (username is a candidate key) |
| Session | `token → userId, createdAt` |
| Room | `id → name, createdAt`; `name → id` (candidate key) |
| Message | `id → roomId, userId, body, createdAt` |
| DirectMessage | `id → senderId, recipientId, body, createdAt` |
| DmRead | `(userId, otherUserId) → lastReadAt` |

Every determinant is a key (primary or candidate), so the schema is in 3NF and also in BCNF.

## Anomalies checked again

- **Update:** a password lives in one `User` row. A room name lives in one `Room` row.
- **Insert:** a user can sign up with no messages, and a room can exist empty (`general` is created by the first migration with no messages).
- **Delete:** deleting a message deletes only that message. Deleting a user removes their sessions (CASCADE) but keeps their messages with `userId = NULL` (SET NULL), so other people's chat history stays whole. See query Q13 in [07-query-outputs.txt](07-query-outputs.txt).

## Intentional exceptions

None. There is no denormalized or cached data. The one place that might be denormalized for speed later is the unread count, and we chose to compute it instead (see the ER doc).
