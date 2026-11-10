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

_To be written by Adarsh._

## DMs and stats (Prem)

_To be written by Prem._
