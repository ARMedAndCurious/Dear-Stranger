import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import Notebook from '../models/Notebook.js';
import Advice from '../models/Advice.js';
import { asyncHandler, validate } from '../middleware/index.js';
import { ttsVoices, synthesize } from '../services/tts.js';

const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many read-aloud requests. Please try again later.' } });
const schema = z.object({ page: z.number().int().min(1).max(999999), offset: z.number().int().min(0).max(10000), length: z.number().int().min(1).max(2000), language: z.enum(Object.keys(ttsVoices)).nullable() }).strict();

router.post('/:slug', limiter, validate(schema), asyncHandler(async (req, res) => {
  const notebook = await Notebook.findOne({ slug: req.params.slug }).select('_id').lean();
  if (!notebook) return res.status(404).json({ error: 'Notebook not found' });
  const { page, offset, length, language } = req.body;
  const entry = await Advice.findOne({ notebookId: notebook._id, moderationStatus: 'approved' }).sort({ createdAt: 1, _id: 1 }).skip(page - 1).select('originalText originalLanguage translations').lean();
  if (!entry) return res.status(404).json({ error: 'Approved page not found' });
  const text = language && language !== entry.originalLanguage ? entry.translations?.[language] : entry.originalText;
  if (!text || offset + length > text.length || !text.slice(offset, offset + length).trim()) return res.status(400).json({ error: 'Read-aloud page is unavailable in this language' });
  const target = language || entry.originalLanguage;
  if (!ttsVoices[target]) return res.status(400).json({ error: 'Select a supported reading language' });
  try {
    const audio = await synthesize(text.slice(offset, offset + length), target);
    if (!await Advice.exists({ _id: entry._id, notebookId: notebook._id, moderationStatus: 'approved', originalText: entry.originalText })) return res.status(404).json({ error: 'Page is no longer available' });
    res.set('Content-Type', 'audio/wav'); res.send(audio);
  } catch { res.status(503).json({ error: 'Gnani Read Aloud is unavailable. You can try a matching browser voice.' }); }
}));
export default router;
