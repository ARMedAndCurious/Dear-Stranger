import crypto from 'node:crypto';
import mongoose from 'mongoose';

export const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const validate = schema => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: 'Validation failed', details: result.error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })) });
  req.body = result.data;
  next();
};
export const requireAuth = (req, res, next) => req.session.userId ? next() : res.status(401).json({ error: 'Please sign in' });
export const csrfToken = req => {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  return req.session.csrfToken;
};
export const csrfProtection = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const actual = req.get('X-CSRF-Token');
  const expected = req.session.csrfToken;
  if (!actual || !expected || !/^[a-f0-9]{64}$/.test(actual) || !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) return res.status(403).json({ error: 'Invalid CSRF token' });
  next();
};
export const errorHandler = (err, req, res, next) => {
  if (err.code === 11000) return res.status(409).json({ error: err.keyPattern?.slug ? 'This notebook URL is already taken' : 'An account with this email already exists' });
  if (err instanceof mongoose.Error.CastError) return res.status(400).json({ error: 'Invalid identifier' });
  if (err instanceof mongoose.Error.ValidationError) return res.status(400).json({ error: 'Validation failed' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
  console.error('Request failed:', err.name);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
};
