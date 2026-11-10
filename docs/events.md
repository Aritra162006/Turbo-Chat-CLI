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

Planned (Aritra): `user:joined`, `user:left`, `users:list` for presence.

## Rooms (Adarsh)

_To be written by Adarsh._

## DMs and stats (Prem)

_To be written by Prem._
