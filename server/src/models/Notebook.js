import mongoose from 'mongoose';
import { categories } from '../validation/categories.js';

const notebookSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 1000 },
  slug: { type: String, required: true, unique: true, lowercase: true, maxlength: 80 },
  visibility: { type: String, enum: ['public', 'unlisted'], required: true },
  category: { type: String, enum: categories },
}, { timestamps: true });
notebookSchema.index({ visibility: 1, createdAt: -1, _id: -1 });
export default mongoose.model('Notebook', notebookSchema);
