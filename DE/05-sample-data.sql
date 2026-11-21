-- Sample data for Turbo Chat. Run on a fresh database after `npx prisma migrate deploy`
-- (the migration already inserts the 'general' room with id 1).
--   psql "$DATABASE_URL" -f DE/05-sample-data.sql
-- Every user's password is password123 (bcrypt hash below, cost 10).
-- Times are relative to now() so the "last 7 days" queries always find data.

-- 5 users
INSERT INTO "User" ("username", "passwordHash", "createdAt") VALUES
  ('alice', '$2b$10$DmLqAFsM76lz0Xu43PTBK.BoBsFiHQStxW10U5yuNCRu55AR4/nfm', now() - interval '30 days'),
  ('bob',   '$2b$10$DmLqAFsM76lz0Xu43PTBK.BoBsFiHQStxW10U5yuNCRu55AR4/nfm', now() - interval '29 days'),
  ('carol', '$2b$10$DmLqAFsM76lz0Xu43PTBK.BoBsFiHQStxW10U5yuNCRu55AR4/nfm', now() - interval '20 days'),
  ('dave',  '$2b$10$DmLqAFsM76lz0Xu43PTBK.BoBsFiHQStxW10U5yuNCRu55AR4/nfm', now() - interval '10 days'),
  ('eve',   '$2b$10$DmLqAFsM76lz0Xu43PTBK.BoBsFiHQStxW10U5yuNCRu55AR4/nfm', now() - interval '2 days');

-- Login sessions (one row per logged-in terminal). alice has two terminals open.
INSERT INTO "Session" ("token", "userId") VALUES
  (gen_random_uuid()::text, 1),
  (gen_random_uuid()::text, 1),
  (gen_random_uuid()::text, 2),
  (gen_random_uuid()::text, 3),
  (gen_random_uuid()::text, 4);

-- Two more rooms next to 'general' (id 1)
INSERT INTO "Room" ("name") VALUES ('random'), ('dev');

-- Room messages
INSERT INTO "Message" ("roomId", "userId", "body", "createdAt") VALUES
  (1, 1, 'Hi everyone!',                          now() - interval '6 days'),
  (1, 2, 'Hey alice',                             now() - interval '6 days' + interval '1 minute'),
  (1, 3, 'Morning all',                           now() - interval '5 days'),
  (1, 1, 'Did anyone finish the DE report?',      now() - interval '3 days'),
  (1, 4, 'Working on it',                         now() - interval '3 days' + interval '2 minutes'),
  (1, 2, 'Same here',                             now() - interval '2 days'),
  (1, 5, 'Just joined, hello!',                   now() - interval '1 day'),
  (1, 3, 'Welcome eve',                           now() - interval '1 day' + interval '30 seconds'),
  (2, 2, 'Anyone watching the match tonight?',    now() - interval '4 days'),
  (2, 4, 'Yes!',                                  now() - interval '4 days' + interval '1 minute'),
  (2, 2, 'Great game',                            now() - interval '3 days'),
  (3, 1, 'Pushed the socket.io fix',              now() - interval '2 days'),
  (3, 3, 'Reviewing it now',                      now() - interval '2 days' + interval '5 minutes'),
  (3, 1, 'Old message from last month',           now() - interval '20 days'),
  (1, 1, 'Older general message',                 now() - interval '15 days');

-- Direct messages
INSERT INTO "DirectMessage" ("senderId", "recipientId", "body", "createdAt") VALUES
  (1, 2, 'Hey bob, got a minute?',     now() - interval '2 days'),
  (2, 1, 'Sure, what''s up?',          now() - interval '2 days' + interval '1 minute'),
  (1, 2, 'Can you review my PR?',      now() - interval '2 days' + interval '2 minutes'),
  (3, 1, 'Lunch tomorrow?',            now() - interval '1 day'),
  (3, 1, 'Ping',                       now() - interval '5 hours'),
  (4, 2, 'Notes from class attached',  now() - interval '3 hours'),
  (2, 4, 'Thanks dave',                now() - interval '2 hours');

-- Read markers: alice has read her chat with bob, bob has read his chat with alice.
INSERT INTO "DmRead" ("userId", "otherUserId", "lastReadAt") VALUES
  (1, 2, now() - interval '1 day'),
  (2, 1, now() - interval '1 day');
