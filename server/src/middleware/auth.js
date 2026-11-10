import { findUserByToken } from '../services/auth.js';

// Reads "Authorization: Bearer <token>", finds the user, and sets req.user and req.token. Rejects with 401 if the token is missing or unknown.
export async function requireAuth(req, res, next) {
  const token = req.get('Authorization')?.replace(/^Bearer /, '');
  const user = await findUserByToken(token);
  if (!user) return res.status(401).json({ error: 'Not logged in' });
  req.user = user;
  req.token = token;
  next();
}
