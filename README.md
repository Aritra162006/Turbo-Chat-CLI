# Turbo Chat

A real-time chat app that runs in the terminal. One Node server, one PostgreSQL database, and a terminal client installed as the command `turbochat`.

```
turbochat (terminal) ── REST: signup, login, history ──►  Express  ─┐
                     └─ socket.io: live messages, presence, DMs ►   ├─► services ─► Prisma ─► PostgreSQL
                                                          socket.io ─┘
```

## Stack

Node 24 (22.18+ works), PostgreSQL, Prisma 7 with `@prisma/adapter-pg`, Express 5, socket.io 4, bcrypt. The client uses only Node built-ins (`readline`, `fetch`, `util.styleText`) plus `socket.io-client`.

## Setup from a fresh clone

### 1. Database

Start PostgreSQL, open `psql` as the admin user (macOS Homebrew: `psql postgres`; Linux: `sudo -u postgres psql`; Windows: `psql -U postgres`) and run:

```sql
CREATE ROLE turbochat WITH LOGIN PASSWORD 'change-me' CREATEDB;
CREATE DATABASE turbochat OWNER turbochat;
```

`CREATEDB` is needed because `prisma migrate dev` creates a temporary shadow database.

### 2. Server

```bash
git clone https://github.com/Aritra162006/Turbo-Chat-CLI.git
cd Turbo-Chat-CLI/server
cp .env.example .env        # change the password in DATABASE_URL if you chose another one
npm install
npx prisma migrate dev      # creates the tables and the general room
npx prisma generate         # Prisma 7 does not do this automatically
npm run db:seed             # optional: alice, bob, carol (password123) and 5,000 messages
npm run dev                 # http://localhost:3000
```

### 3. Client

In a second terminal:

```bash
cd Turbo-Chat-CLI/terminal-client
npm install
npm link                    # installs the turbochat command
turbochat                   # or: turbochat http://<server-ip>:3000
```

To chat from two laptops on the same Wi-Fi, run the server on one and use `turbochat http://<that laptop's IP>:3000` on the other.

## Using the client

Choose login or signup, then type a username and password (the password is hidden). The last 25 messages of `#general` are shown, then new messages appear live. Anything you type is sent to `#general`.

| Command | What it does |
|---|---|
| `/help` | List the commands |
| `/users` | Who is online right now |
| `/quit` | Leave (Ctrl+C and Ctrl+D also work) |

## Tests

From `server/`, with the server running:

```bash
node scripts/chat-test.js tester1                  # terminal A: listens
node scripts/chat-test.js tester2 "hello"          # terminal B: sends, A prints it
bash scripts/check-dms.sh                          # DM and stats REST checks
node scripts/dms-test.js                           # DM socket checks
```

## Documentation

- `docs/events.md`: every REST endpoint and socket event, with inputs, outputs and errors.
- `docs/schema.md`: every table, key, constraint and index, and why.
- `docs/evidence/explain-messages.txt`: `EXPLAIN ANALYZE` showing the history query uses the `(roomId, createdAt)` index.

## Who built what

| Person | Part |
|---|---|
| Aritra | Core server (signup, login, sessions, general room, history, live messages, presence), core database schema, seed and index evidence, the terminal client |
| Prem | Direct messages, unread counts, rate limit, most-active-rooms query and stats endpoint |
| Adarsh | Rooms and membership (not merged yet) |

## Decisions

- **Session tokens, not JWT.** A login creates a row in `Session` with a random UUID as the primary key. Logout deletes the row, so the token stops working immediately. No extra library needed.
- **Deleted users keep their messages.** `Message.userId` is `ON DELETE SET NULL`, and the client shows "deleted user".
- **One composite index `(roomId, createdAt)`.** The busiest query is "latest 25 messages of a room": Postgres jumps to the room and reads it already in time order, with no sort step. See the evidence file.
- **The `general` room is inserted by the first migration**, not only the seed, so it exists in every database.
- **Lengths are checked in JavaScript** (username 3-20, message 1-500), and the columns are plain `TEXT`.
- **Only services touch the database.** Routes and socket handlers call functions in `server/src/services/`, so rules and the message shape live in one place for both REST and socket.io.
- **History over REST, live messages over socket.io.** History is one request and one answer. Live messages arrive without the client asking, so they need a connection that stays open.
- **Presence is kept in memory.** Each connection joins the socket.io room `user:<id>`; the room's size is the number of open tabs. `user:joined` is sent on the first tab, `user:left` after the last one closes.
