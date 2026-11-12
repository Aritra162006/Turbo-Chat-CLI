// Demo data: 3 users and 5,000 messages in general. Run with: npm run db:seed
// 5,000 rows, not 30: on a tiny table Postgres skips the index, so EXPLAIN would prove nothing.
import bcrypt from 'bcrypt';
import { prisma } from '../src/db.js';

const PASSWORD = 'password123';
const MESSAGE_COUNT = 5000;

const passwordHash = await bcrypt.hash(PASSWORD, 10);
const names = ['alice', 'bob', 'carol'];

// skipDuplicates: running the seed twice doesn't fail on existing usernames.
await prisma.user.createMany({
  data: names.map((username) => ({ username, passwordHash })),
  skipDuplicates: true,
});

const users = await prisma.user.findMany({ where: { username: { in: names } } });
const general = await prisma.room.findUnique({ where: { name: 'general' } });

// One message per minute going back in time, so every createdAt is different and recent.
const now = Date.now();
const messages = [];
for (let i = 0; i < MESSAGE_COUNT; i++) {
  messages.push({
    roomId: general.id,
    userId: users[i % users.length].id,
    body: 'Seed message ' + (MESSAGE_COUNT - i),
    createdAt: new Date(now - i * 60_000),
  });
}
await prisma.message.createMany({ data: messages });

console.log(`Seeded ${names.join(', ')} (password: ${PASSWORD}) and ${MESSAGE_COUNT} messages in general`);
await prisma.$disconnect();
