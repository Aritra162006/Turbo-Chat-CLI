-- Rename tables and columns to match the Prisma model names (no @map/@@map).
-- Written by hand as RENAMEs so existing rows (like the 'general' room) are kept.

-- Tables
ALTER TABLE "users"    RENAME TO "User";
ALTER TABLE "sessions" RENAME TO "Session";
ALTER TABLE "rooms"    RENAME TO "Room";
ALTER TABLE "messages" RENAME TO "Message";

-- Columns
ALTER TABLE "User"    RENAME COLUMN "password_hash" TO "passwordHash";
ALTER TABLE "User"    RENAME COLUMN "created_at"    TO "createdAt";
ALTER TABLE "Session" RENAME COLUMN "user_id"       TO "userId";
ALTER TABLE "Session" RENAME COLUMN "created_at"    TO "createdAt";
ALTER TABLE "Room"    RENAME COLUMN "created_at"    TO "createdAt";
ALTER TABLE "Message" RENAME COLUMN "room_id"       TO "roomId";
ALTER TABLE "Message" RENAME COLUMN "user_id"       TO "userId";
ALTER TABLE "Message" RENAME COLUMN "created_at"    TO "createdAt";

-- Types: no @db.VarChar / @db.Uuid any more, so plain TEXT (length limits live in JS validation)
ALTER TABLE "User"    ALTER COLUMN "username" SET DATA TYPE TEXT;
ALTER TABLE "Room"    ALTER COLUMN "name"     SET DATA TYPE TEXT;
ALTER TABLE "Message" ALTER COLUMN "body"     SET DATA TYPE TEXT;
ALTER TABLE "Session" ALTER COLUMN "token"    SET DATA TYPE TEXT;

-- Constraint and index names, so they match what Prisma expects
ALTER TABLE "User"    RENAME CONSTRAINT "users_pkey"    TO "User_pkey";
ALTER TABLE "Session" RENAME CONSTRAINT "sessions_pkey" TO "Session_pkey";
ALTER TABLE "Room"    RENAME CONSTRAINT "rooms_pkey"    TO "Room_pkey";
ALTER TABLE "Message" RENAME CONSTRAINT "messages_pkey" TO "Message_pkey";
ALTER TABLE "Session" RENAME CONSTRAINT "sessions_user_id_fkey" TO "Session_userId_fkey";
ALTER TABLE "Message" RENAME CONSTRAINT "messages_room_id_fkey" TO "Message_roomId_fkey";
ALTER TABLE "Message" RENAME CONSTRAINT "messages_user_id_fkey" TO "Message_userId_fkey";
ALTER INDEX "users_username_key"              RENAME TO "User_username_key";
ALTER INDEX "rooms_name_key"                  RENAME TO "Room_name_key";
ALTER INDEX "messages_room_id_created_at_idx" RENAME TO "Message_roomId_createdAt_idx";

-- Sequences behind the auto-increment ids
ALTER SEQUENCE "users_id_seq"    RENAME TO "User_id_seq";
ALTER SEQUENCE "rooms_id_seq"    RENAME TO "Room_id_seq";
ALTER SEQUENCE "messages_id_seq" RENAME TO "Message_id_seq";
