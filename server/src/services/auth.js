import bcrypt from 'bcrypt';
import { prisma } from '../db.js';

const SALT_ROUNDS = 10;

// Checks the password and starts a new session. A wrong username and a wrong password give the same error, so nobody can probe which usernames exist.
export async function login(username, password) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    const e = new Error('Wrong username or password');
    e.status = 401;
    throw e;
  }
  const session = await prisma.session.create({ data: { userId: user.id } });
  return { username: user.username, token: session.token };
}

// Creates the user and their first session together, so we never get one without the other.
export async function signup(username, password) {
  try {
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
        sessions: { create: {} },
      },
      include: { sessions: true },
    });
    return { username: user.username, token: user.sessions[0].token };
  } catch (err) {
    // P2002 means the username already exists
    if (err.code === 'P2002') {
      const e = new Error('Username already exists. Please check or enter something else.');
      e.status = 409;
      throw e;
    }
    throw err;
  }
}
