-- Turbo Chat: final database schema (PostgreSQL).
-- This is the end state of the three Prisma migrations in server/prisma/migrations/,
-- written out in one place so it is easy to read. The app itself creates it with:
--   cd server && npx prisma migrate deploy
-- Names are camelCase to match the Prisma models, so SQL must quote them.

CREATE TABLE "User" (
  "id"           SERIAL       PRIMARY KEY,
  "username"     TEXT         NOT NULL,                  -- 3-20 letters, numbers or _ (checked in the API)
  "passwordHash" TEXT         NOT NULL,                  -- bcrypt hash, never the password
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- One row per logged-in terminal. The random token is the key. Logout deletes the row.
CREATE TABLE "Session" (
  "token"     TEXT         PRIMARY KEY,
  "userId"    INTEGER      NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Room" (
  "id"        SERIAL       PRIMARY KEY,
  "name"      TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Room_name_key" ON "Room"("name");

-- userId can be NULL: if a user is deleted, their messages stay and show as "deleted user".
CREATE TABLE "Message" (
  "id"        SERIAL       PRIMARY KEY,
  "roomId"    INTEGER      NOT NULL REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "userId"    INTEGER      REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "body"      TEXT         NOT NULL,                     -- 1-500 characters (checked in the API)
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- "Latest 25 messages of room X" reads this index backwards instead of sorting the table.
CREATE INDEX "Message_roomId_createdAt_idx" ON "Message"("roomId", "createdAt");

CREATE TABLE "DirectMessage" (
  "id"          SERIAL       PRIMARY KEY,
  "senderId"    INTEGER      REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "recipientId" INTEGER      REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "body"        TEXT         NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DirectMessage_sender_recipient_check" CHECK ("senderId" <> "recipientId")
);
CREATE INDEX "DirectMessage_senderId_recipientId_id_idx" ON "DirectMessage"("senderId", "recipientId", "id");

-- When a user last read their chat with another user. Unread = messages newer than this.
CREATE TABLE "DmRead" (
  "userId"      INTEGER      NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "otherUserId" INTEGER      NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "lastReadAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "otherUserId")
);

-- Every database starts with the general room.
INSERT INTO "Room" ("name") VALUES ('general');
