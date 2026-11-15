# Database schema

One section per person. Only edit your own section.

## Core (Aritra)

Defined in `server/prisma/schema.prisma`. Table names match the model names exactly (`"User"`, `"Session"`, ...), so raw SQL needs double quotes.

### User
| Column | Type | Notes |
|---|---|---|
| id | serial, primary key | |
| username | text, unique | 3-20 letters, numbers or `_` (checked in JavaScript) |
| passwordHash | text | bcrypt hash, never the password |
| createdAt | timestamp | default now |

### Session
| Column | Type | Notes |
|---|---|---|
| token | text, primary key | random uuid. This is the login token. Logout deletes the row. No expiry |
| userId | int, foreign key to User | `ON DELETE CASCADE`: deleting a user ends their sessions |
| createdAt | timestamp | |

### Room
| Column | Type | Notes |
|---|---|---|
| id | serial, primary key | |
| name | text, unique | the `general` room is inserted by the first migration |
| createdAt | timestamp | |

### Message
| Column | Type | Notes |
|---|---|---|
| id | serial, primary key | |
| roomId | int, foreign key to Room | `ON DELETE CASCADE` |
| userId | int, nullable, foreign key to User | `ON DELETE SET NULL`: messages of a deleted user stay, shown as "deleted user" |
| body | text | 1-500 characters (checked in JavaScript) |
| createdAt | timestamp | |

Index: `(roomId, createdAt)` on `Message`. It makes "latest 25 messages of room X" an index scan instead of reading the whole table.

Signup creates the `User` and its first `Session` in one nested write, so you never get one without the other.

## Rooms (Adarsh)

Defined in `server/prisma/models/rooms.prisma` and extended in `server/prisma/schema.prisma`.

### RoomMember

Represents a user's membership within a specific chat room. The `general` room does not use `RoomMember` records since all users are automatically members.

| Column | Type | Details |
|---|---|---|
| roomId | Int | Foreign key to Room(id), ON DELETE CASCADE |
| userId | Int | Foreign key to User(id), ON DELETE CASCADE |
| role | String | Membership role: `'owner'` for creator, `'member'` for joiners. Defaults to `'member'` |
| joinedAt | DateTime | Membership timestamp, defaults to `now()` |

- **Composite Primary Key**: `(roomId, userId)`
- **Foreign Keys**:
  - `roomId` references `Room(id)` with `ON DELETE CASCADE` (deleting a room deletes its memberships).
  - `userId` references `User(id)` with `ON DELETE CASCADE` (deleting a user removes them from all rooms).
- **Index**:
  - `@@index([userId])` (`RoomMember_userId_idx`): Speeds up lookups of all rooms a user belongs to, such as `getMyRoomNames(userId)` and `listRooms(userId)`.
- **Database CHECK Constraints**:
  - `RoomMember_role_check`: `CHECK ("role" IN ('owner', 'member'))` ensures role can only be `'owner'` or `'member'`.
  - `Room_name_check`: `CHECK ("name" ~ '^[a-z0-9_-]{1,30}$')` enforces valid room name characters and length at the database layer.

### Room Creation and Membership Lifecycle
- When a user joins a room that does not exist, the `Room` row and the initial `RoomMember` row with role `'owner'` are created together in a single atomic Prisma transaction (`prisma.$transaction`).
- Subsequent joins create a `RoomMember` row with role `'member'`.
- Duplicate joins are idempotent and do not create duplicate rows due to the composite primary key `(roomId, userId)`.
- Leaving a room deletes the corresponding `RoomMember` row.

## DMs and stats (Prem)

### DirectMessage

| Column | Type | Details |
|---|---|---|
| id | Int | Primary key, auto-increment |
| senderId | Int? | Foreign key to User(id), ON DELETE SET NULL |
| recipientId | Int? | Foreign key to User(id), ON DELETE SET NULL |
| body | String | Message content |
| createdAt | DateTime | Defaults to now() |

- CHECK constraint: `senderId <> recipientId`
- Index: `(senderId, recipientId, id)`

### DmRead

| Column | Type | Details |
|---|---|---|
| userId | Int | Foreign key to User(id), ON DELETE CASCADE |
| otherUserId | Int | Foreign key to User(id), ON DELETE CASCADE |
| lastReadAt | DateTime | Defaults to now() |

- Composite primary key: `(userId, otherUserId)`

### Most Active Rooms

The `mostActiveRooms()` service uses a tagged Prisma `$queryRaw` query to return the five rooms with the highest message counts in the last seven days.

#### EXPLAIN ANALYZE

Executed using:

`EXPLAIN (ANALYZE, BUFFERS)`

Observed execution plan:

- `Seq Scan` on `Message`: 22 rows matched the seven-day filter.
- `Seq Scan` on `Room`: 1 row scanned.
- `Hash Join`: joined messages with rooms using `roomId`.
- `HashAggregate`: grouped messages by room ID.
- `Sort`: quicksort, 25 kB memory.
- `Limit`: returned 1 room (fewer than the maximum of 5).

Observed metrics:

| Metric | Result |
|---|---:|
| Planning Time | 1.677 ms |
| Execution Time | 0.340 ms |
| Shared buffer hits | 5 |
| Message rows processed | 22 |
| Rooms returned | 1 |

Both tables used sequential scans. Given the small amount of data in this test database, PostgreSQL chose sequential scans instead of index scans. This is an observed plan, not evidence that indexes are unnecessary for larger datasets.
EOF