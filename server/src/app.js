import express from 'express';
import session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.js';
import notebookRoutes from './routes/notebooks.js';
import speechRoutes from './routes/speech.js';
import adviceRoutes from './routes/advice.js';
import ttsRoutes from './routes/tts.js';
import { csrfProtection, errorHandler } from './middleware/index.js';

export function createApp({ store, secret, clientOrigin, production = false }) {
  const app = express();
  if (production) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: clientOrigin, credentials: true }));
  app.use(express.json({ limit: '16kb' }));
  const cookieOptions = { httpOnly: true, secure: production, sameSite: 'lax', path: '/' };
  app.use(session({ name: 'ds.sid', secret, store, resave: false, saveUninitialized: false, cookie: { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 } }));
  app.use((req, res, next) => { req.cookieOptions = cookieOptions; res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api', csrfProtection);
  app.use('/api/auth', authRoutes);
  app.use('/api/speech', speechRoutes);
  app.use('/api/advice', adviceRoutes);
  app.use('/api/tts', ttsRoutes);
  app.use('/api/notebooks', notebookRoutes);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(errorHandler);
  return app;
}
