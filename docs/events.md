# Endpoints and socket events

One section per person. Only edit your own section.

Every message uses one shape (`toPayload` in `server/src/services/messages.js`):
`{ id, room, username, body, createdAt }`. `username` is `null` if the user was deleted.

Auth: send `Authorization: Bearer <token>` on REST calls. For socket.io, connect with `io(url, { auth: { token } })`.

## Core (Aritra)

### REST
| Method and path | Auth | Body | Success | Errors |
|---|---|---|---|---|
| `POST /api/signup` | no | `{ username, password }` | 201 `{ username, token }` | 400 bad input, 409 username taken |
| `POST /api/login` | no | `{ username, password }` | 200 `{ username, token }` | 400 missing fields, 401 wrong username or password |
| `GET /api/me` | yes | | 200 `{ id, username }` | 401 |
| `POST /api/logout` | yes | | 204 | 401 |
| `GET /api/rooms/general/messages` | yes | | 200 array of the last 25 messages, oldest first | 401 |

Errors look like `{ "error": "message text" }`.

### Socket
| Direction | Event | Data | Notes |
|---|---|---|---|
| connect | (handshake) | `auth: { token }` | Bad or missing token: `connect_error` with message `unauthorized`. A good connection joins the `general` room |
| client to server | `message:send` | `{ room, body }` and an ack callback | Ack: `{ ok: true, message }` or `{ ok: false, error }`. You must be in that room. Body is 1-500 characters after trimming |
| server to client | `message:new` | message payload | Sent to everyone in the room, including the sender |
| client to server | `users:list` | ack callback only | Ack: `{ ok: true, users: [username, ...] }`, sorted, each name once |
| server to client | `user:joined` | `{ username }` | Sent to everyone else when a user opens their **first** connection |
| server to client | `user:left` | `{ username }` | Sent to everyone when a user closes their **last** connection |

Presence lives in memory only. Every connection joins the socket.io room `user:<id>` (the same room the DM code uses), and that room's size is the number of open tabs. Opening a second tab or closing one of two sends nothing. A server restart forgets everyone, and clients show up again when they reconnect.

## Rooms (Adarsh)

### REST

All room endpoints require authentication (`Authorization: Bearer <token>`).

| Method and path | Auth | Query / Body | Success | Errors |
|---|---|---|---|---|
| `GET /api/rooms` | yes | — | 200 `[{ name, memberCount, joined }]` | 401 unauthenticated |
| `GET /api/rooms/:room/messages` | yes | — | 200 array of the last 25 messages, oldest first | 401 unauthenticated, 403 not a member, 404 room not found |

#### Room listing: `GET /api/rooms`
Returns all rooms, their member counts, and whether the authenticated user is currently a member.
- Always includes `general`.
- For `general`, `memberCount` equals the total number of registered users, and `joined` is always `true`.
- Example response:
```json
[
  { "name": "general", "memberCount": 4, "joined": true },
  { "name": "engineering", "memberCount": 2, "joined": true },
  { "name": "random", "memberCount": 1, "joined": false }
]
```

#### Room history: `GET /api/rooms/:room/messages`
Returns the 25 most recent messages in the specified room, ordered oldest first (reusing the standard `toPayload` message shape `{ id, room, username, body, createdAt }`).
- For `general`, all authenticated users are permitted.
- For custom rooms, non-members receive HTTP 403 (`{ "error": "Forbidden: you are not a member of this room" }`).
- If the room does not exist, returns HTTP 404 (`{ "error": "Room not found" }`).

### Room Name Restrictions
- Room names must match the regex `/^[a-z0-9_-]{1,30}$/` (1 to 30 lowercase alphanumeric characters, underscores, or hyphens).
- Invalid room names throw HTTP 400 (`Invalid room name`).
- The pattern prevents collision with personal socket rooms like `user:<id>`.

### The `general` Room
- Special room present by default in every database.
- Every user is automatically a member; no `RoomMember` records are ever created for `general`.
- Users cannot leave `general` (returns 400 error).

### Socket Events

| Direction | Event | Data | Notes |
|---|---|---|---|
| Client to server | `room:join` | `{ room }` with ack callback | Joins room, creating it with role `owner` if it does not exist, or role `member` if it exists. Idempotent. |
| Server to client | `room:user-joined` | `{ room, username }` | Broadcast to all other room members **only** when a user becomes a **new** member. |
| Client to server | `room:leave` | `{ room }` with ack callback | Leaves room and deletes `RoomMember` record. Cannot leave `general`. |
| Server to client | `room:user-left` | `{ room, username }` | Broadcast to remaining room members when a member leaves. |

#### Acknowledgements and Payloads

- **`room:join` ack**:
  - Success: `{ ok: true, room: { name, memberCount } }`
  - Error: `{ ok: false, error }` (e.g. invalid name 400)
- **`room:leave` ack**:
  - Success: `{ ok: true }`
  - Error: `{ ok: false, error }` (e.g. leaving general 400, not a member 404)
- **`room:user-joined` broadcast**:
  - Shape: `{ room, username }`
- **`room:user-left` broadcast**:
  - Shape: `{ room, username }`

#### Example Usage
```javascript
// Join a room
socket.emit('room:join', { room: 'devs' }, (ack) => {
  if (ack.ok) {
    console.log(`Joined ${ack.room.name}, members: ${ack.room.memberCount}`);
  } else {
    console.error('Join failed:', ack.error);
  }
});

// Leave a room
socket.emit('room:leave', { room: 'devs' }, (ack) => {
  if (ack.ok) {
    console.log('Left room');
  }
});
```

### Reconnection Limitation
`socket.join()` and `socket.leave()` affect only the current socket connection. Other tabs belonging to the same user receive the updated membership when they reconnect.

## DMs and stats (Prem)

### REST

All endpoints require authentication.

| Method and path | Body / Query | Success | Errors |
|---|---|---|---|
| `GET /api/dms` | — | 200: array of conversations `{ username, lastMessage, unread }` | 401 |
| `GET /api/dms/:username/messages` | Optional `before=<id>` | 200: up to 25 messages, oldest first | 400 invalid before, 401, 404 unknown user |
| `POST /api/dms/:username/read` | — | 204 | 401, 404 unknown user |
| `GET /api/stats/rooms` | — | 200: up to 5 most active rooms in the last 7 days | 401 |

### DM payload

`{ id, from, to, body, createdAt }`

`from` or `to` is `null` if that user was deleted.

### Socket

| Direction | Event | Data | Notes |
|---|---|---|---|
| Client to server | `dm:send` | `{ toUsername, body }` with an ack callback | Body must be 1-500 characters after trimming |
| Server to client | `dm:new` | DM payload | Sent to sender and recipient user rooms |

Successful ack: `{ ok: true, message, recipientOnline }`.

Error ack: `{ ok: false, error }`.

### Stats

`GET /api/stats/rooms` returns at most 5 rooms, ordered by message count descending, for the last 7 days.