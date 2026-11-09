import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { csrfToken } from '../middleware/index.js';

const regenerate = req => new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
const establish = async (req, res, user) => {
  await regenerate(req);
  req.session.userId = user.id;
  res.json({ user: { id: user.id, email: user.email }, csrfToken: csrfToken(req) });
};
export const register = async (req, res) => {
  const passwordHash = await bcrypt.hash(req.body.password, 12);
  const user = await User.create({ email: req.body.email, passwordHash });
  await establish(req, res, user);
};
export const login = async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  // Compare even when the account does not exist to reduce account enumeration via timing.
  const valid = await bcrypt.compare(req.body.password, user?.passwordHash || '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6Ttxw7XPjP8p2tHk9tJ2R8fKq5Y8K');
  if (!user || !valid) return res.status(401).json({ error: 'Invalid email or password' });
  await establish(req, res, user);
};
export const me = async (req, res) => {
  const user = req.session.userId ? await User.findById(req.session.userId) : null;
  if (!user && req.session.userId) delete req.session.userId;
  res.json({ user: user ? { id: user.id, email: user.email } : null, csrfToken: csrfToken(req) });
};
export const logout = (req, res, next) => req.session.destroy(err => {
  if (err) return next(err);
  res.clearCookie('ds.sid', req.cookieOptions);
  res.json({ message: 'Signed out' });
});
