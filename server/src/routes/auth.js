import { Router } from 'express';
import { login, logout, signup } from '../services/auth.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

// Checks the username and password, then creates the account.
authRouter.post('/signup', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || !/^\w{3,20}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 letters, numbers or _' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  res.status(201).json(await signup(username, password));
});

// Logs in an existing user and returns a new session token.
authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  res.json(await login(username, password));
});

// Returns who the token belongs to.
authRouter.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

// Deletes this session, so the token stops working.
authRouter.post('/logout', requireAuth, async (req, res) => {
  await logout(req.token);
  res.status(204).end();
});
