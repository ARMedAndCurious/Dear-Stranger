import Advice from '../models/Advice.js';
import Notebook from '../models/Notebook.js';
import { moderate } from '../services/moderation.js';
import { languages, translate } from '../services/translation.js';
import mongoose from 'mongoose';

async function translateEntry(entry, target) {
  let translatedText = null, translationError = null;
  if (target && target !== entry.originalLanguage) {
    translatedText = entry.translations?.[target] || null;
    if (!translatedText) {
      try {
        translatedText = await translate(entry.originalText, target, entry.originalLanguage);
        const review = await moderate(translatedText);
        if (review.status !== 'approved') throw new Error('Translation needs review');
        const updated = await Advice.updateOne({ _id: entry._id, moderationStatus: 'approved', originalText: entry.originalText }, { $set: { [`translations.${target}`]: translatedText } });
        if (!updated.matchedCount) return { unavailable: true };
      } catch { translatedText = null; translationError = 'Translation is unavailable. Showing the original.'; }
    }
  }
  return { translatedText, translationError };
}

export async function random(req, res) {
  const { exclude, id, language } = req.query;
  if ((exclude !== undefined && (typeof exclude !== 'string' || !/^[a-f\d]{24}$/i.test(exclude))) || (id !== undefined && (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)))) return res.status(400).json({ error: 'Invalid advice ID' });
  if (language !== undefined && (typeof language !== 'string' || !languages.includes(language))) return res.status(400).json({ error: 'Unsupported language' });
  async function select(skipId) {
    const match = { moderationStatus: 'approved' };
    if (id) match._id = new mongoose.Types.ObjectId(id);
    else if (skipId) match._id = { $ne: new mongoose.Types.ObjectId(skipId) };
    return (await Advice.aggregate([
      { $match: match },
      { $lookup: { from: Notebook.collection.name, localField: 'notebookId', foreignField: '_id', as: 'notebook' } },
      { $unwind: '$notebook' },
      { $match: { 'notebook.visibility': 'public' } },
      { $sample: { size: 1 } },
      { $project: { originalText: 1, originalLanguage: 1, translations: 1, notebookId: 1, 'notebook.title': 1, 'notebook.slug': 1 } },
    ]))[0];
  }
  let entry = await select(exclude);
  if (!entry && exclude && !id) entry = await select();
  if (!entry) return id ? res.status(404).json({ error: 'Page is no longer available' }) : res.json({ advice: null });
  const { translatedText, translationError, unavailable } = await translateEntry(entry, language);
  if (unavailable) return res.status(404).json({ error: 'Page is no longer available' });
  const [stillApproved, stillPublic] = await Promise.all([
    Advice.exists({ _id: entry._id, notebookId: entry.notebookId, moderationStatus: 'approved', originalText: entry.originalText }),
    Notebook.exists({ _id: entry.notebookId, visibility: 'public' }),
  ]);
  if (!stillApproved || !stillPublic) return res.status(404).json({ error: 'Page is no longer available' });
  return res.json({ advice: { id: entry._id, originalText: entry.originalText, originalLanguage: entry.originalLanguage || null, translatedText, notebook: { title: entry.notebook.title, slug: entry.notebook.slug } }, translationError });
}

export async function submit(req, res) {
  const notebook = await Notebook.findOne({ slug: req.params.slug }).select('_id').lean();
  if (!notebook) return res.status(404).json({ error: 'Notebook not found' });
  let advice;
  try { advice = await Advice.create({ notebookId: notebook._id, originalText: req.body.text, submissionId: req.body.submissionId, originalLanguage: req.body.originalLanguage || null }); }
  catch (error) {
    if (error.code !== 11000 || !error.keyPattern?.submissionId) throw error;
    const existing = await Advice.findOne({ notebookId: notebook._id, submissionId: req.body.submissionId }).select('originalText originalLanguage').lean();
    if (!existing || existing.originalText !== req.body.text || (existing.originalLanguage || null) !== (req.body.originalLanguage || null)) return res.status(409).json({ error: 'Submission ID already used for different advice' });
    return res.status(200).json({ message: 'Your words have been added to the notebook’s review queue. Thank you for leaving something thoughtful.' });
  }
  const result = await moderate(advice.originalText);
  // A manual decision made during moderation must never be overwritten.
  await Advice.updateOne({ _id: advice._id, moderationStatus: 'pending' }, { $set: { moderationStatus: result.status, moderationReason: result.reason } });
  res.status(201).json({ message: 'Your words have been added to the notebook’s review queue. Thank you for leaving something thoughtful.' });
}

export async function pages(req, res) {
  const notebook = await Notebook.findOne({ slug: req.params.slug }).select('_id').lean();
  if (!notebook) return res.status(404).json({ error: 'Notebook not found' });
  const raw = req.query.page ?? '1';
  if (typeof raw !== 'string' || !/^[1-9]\d{0,5}$/.test(raw)) return res.status(400).json({ error: 'Invalid page number' });
  const target = req.query.language;
  if (target !== undefined && (typeof target !== 'string' || !languages.includes(target))) return res.status(400).json({ error: 'Unsupported language' });
  const page = Number(raw), filter = { notebookId: notebook._id, moderationStatus: 'approved' };
  const [total, entry] = await Promise.all([Advice.countDocuments(filter), Advice.findOne(filter).sort({ createdAt: 1, _id: 1 }).skip(page - 1).select('originalText originalLanguage translations createdAt').lean()]);
  if (!entry) return res.json({ page, total, advice: null });
  const { translatedText, translationError, unavailable } = await translateEntry(entry, target);
  if (unavailable) return res.status(404).json({ error: 'Page is no longer available' });
  if (!await Advice.exists({ _id: entry._id, moderationStatus: 'approved', originalText: entry.originalText })) return res.status(404).json({ error: 'Page is no longer available' });
  res.json({ page, total, advice: { originalText: entry.originalText, originalLanguage: entry.originalLanguage || null, createdAt: entry.createdAt, translatedText, translationLanguage: translatedText ? target : null }, translationError });
}

async function ownedNotebook(req) { return Notebook.findOne({ _id: req.params.id, owner: req.session.userId }).select('_id title').lean(); }
export async function manage(req, res) {
  const notebook = await ownedNotebook(req);
  if (!notebook) return res.status(404).json({ error: 'Notebook not found' });
  const entries = await Advice.find({ notebookId: notebook._id }).sort({ createdAt: -1, _id: -1 }).select('originalText moderationStatus moderationReason createdAt').lean();
  res.json({ notebook: { title: notebook.title }, advice: entries });
}
export async function decide(req, res) {
  const notebook = await ownedNotebook(req);
  if (!notebook) return res.status(404).json({ error: 'Notebook not found' });
  const status = { approve: 'approved', reject: 'rejected', remove: 'rejected' }[req.body.action];
  const entry = await Advice.findOneAndUpdate({ _id: req.params.adviceId, notebookId: notebook._id }, { $set: { moderationStatus: status, moderationReason: req.body.action === 'remove' ? 'Removed by notebook owner' : `${status === 'approved' ? 'Approved' : 'Rejected'} by notebook owner` } }, { new: true }).select('moderationStatus').lean();
  if (!entry) return res.status(404).json({ error: 'Advice not found' });
  res.json({ message: 'Review saved' });
}
