import Notebook from '../models/Notebook.js';
import Advice from '../models/Advice.js';
import { createWithUniqueSlug } from '../services/slugs.js';
import { categories } from '../validation/categories.js';

const publicFields = 'title description slug visibility category createdAt';
export const explore = async (req, res) => {
  const { search = '', page = '1', category = '' } = req.query;
  if (typeof search !== 'string' || search.length > 100 || typeof page !== 'string' || !/^[1-9]\d{0,3}$/.test(page) || typeof category !== 'string' || (category && !categories.includes(category) && category !== 'Uncategorized')) return res.status(400).json({ error: 'Invalid search, category or page' });
  const filter = { visibility: 'public' };
  if (category) filter.category = category === 'Uncategorized' ? { $exists: false } : category;
  if (search.trim()) filter.title = { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const limit = 12, number = Number(page);
  const [total, notebooks] = await Promise.all([Notebook.countDocuments(filter), Notebook.find(filter).select('title description slug category').sort({ createdAt: -1, _id: -1 }).skip((number - 1) * limit).limit(limit).lean()]);
  const counts = await Advice.aggregate([{ $match: { notebookId: { $in: notebooks.map(n => n._id) }, moderationStatus: 'approved' } }, { $group: { _id: '$notebookId', count: { $sum: 1 } } }]);
  res.json({ notebooks: notebooks.map(({ _id, ...n }) => ({ ...n, approvedCount: counts.find(c => String(c._id) === String(_id))?.count || 0 })), page: number, total, limit });
};
export const create = async (req, res) => {
  const notebook = await createWithUniqueSlug(Notebook, { ...req.body, owner: req.session.userId });
  res.status(201).json({ notebook: { id: notebook.id, title: notebook.title, description: notebook.description, slug: notebook.slug, visibility: notebook.visibility, category: notebook.category || null, createdAt: notebook.createdAt } });
};
export const mine = async (req, res) => {
  const notebooks = await Notebook.find({ owner: req.session.userId }).select(publicFields).sort({ createdAt: -1 }).lean();
  const counts = await Advice.aggregate([{ $match: { notebookId: { $in: notebooks.map(n => n._id) }, moderationStatus: { $in: ['approved', 'pending', 'needs_review'] } } }, { $group: { _id: { notebook: '$notebookId', status: '$moderationStatus' }, count: { $sum: 1 } } }]);
  for (const n of notebooks) { n.approvedCount = 0; n.reviewCount = 0; }
  for (const item of counts) { const n = notebooks.find(book => String(book._id) === String(item._id.notebook)); if (n) { if (item._id.status === 'approved') n.approvedCount += item.count; else n.reviewCount += item.count; } }
  res.json({ notebooks });
};
export const view = async (req, res) => {
  const notebook = await Notebook.findOne({ slug: req.params.slug }).select(publicFields).lean();
  if (!notebook) return res.status(404).json({ error: 'Notebook not found' });
  // Public pages do not need internal database identifiers.
  delete notebook._id;
  res.json({ notebook });
};
export const update = async (req, res) => {
  const { category, ...fields } = req.body;
  const change = { $set: category ? { ...fields, category } : fields };
  if (category === null) change.$unset = { category: 1 };
  const notebook = await Notebook.findOneAndUpdate({ _id: req.params.id, owner: req.session.userId }, change, { new: true, runValidators: true }).select(publicFields).lean();
  if (!notebook) return res.status(404).json({ error: 'Notebook not found' });
  res.json({ notebook });
};
