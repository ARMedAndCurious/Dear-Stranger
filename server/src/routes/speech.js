import express from 'express';
import rateLimit from 'express-rate-limit';
import { speechLanguages, transcribe, validWav } from '../services/speech.js';
const router = express.Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many recordings. Please try again later.' } });
router.post('/transcribe', limiter, express.raw({ type: 'audio/wav', limit: '1mb' }), async (req, res) => {
  if (!speechLanguages.includes(req.query.language)) return res.status(400).json({ error: 'Unsupported speech language' });
  if (!validWav(req.body)) return res.status(400).json({ error: 'Unsupported audio. Please record a WAV clip of up to 30 seconds.' });
  try { res.json(await transcribe(req.body, req.query.language)); }
  catch (err) { res.status(503).json({ error: err.message === 'Speech transcription is not configured' ? err.message : 'Transcription failed or was incomplete. Please try again.' }); }
});
export default router;
