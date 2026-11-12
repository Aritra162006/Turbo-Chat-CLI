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

_To be written by Adarsh._

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