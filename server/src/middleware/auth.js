import { prisma } from '../db.js';

// Reads "Authorization: Bearer <token>", finds the session, and sets req.user and req.token. Rejects with 401 if the token is missing or unknown.
export async function requireAuth(req, res, next) {
  const token = req.get('Authorization')?.replace(/^Bearer /, '');
  const session = token && (await prisma.session.findUnique({
    where: { token },
    include: { user: { select: { id: true, username: true } } },
  }));
  if (!session) return res.status(401).json({ error: 'Not logged in' });
  req.user = session.user;
  req.token = token;
  next();
}
