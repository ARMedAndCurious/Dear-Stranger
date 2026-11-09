import mongoose from 'mongoose';

const adviceSchema = new mongoose.Schema({
  notebookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notebook', required: true },
  originalText: { type: String, required: true, maxlength: 1500 },
  originalLanguage: { type: String, default: null },
  translations: { type: Map, of: String, default: {} },
  moderationStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'needs_review'], default: 'pending', required: true },
  moderationReason: { type: String, default: 'Awaiting moderation' },
  submissionId: { type: String, required: true },
}, { timestamps: true });
adviceSchema.index({ notebookId: 1, submissionId: 1 }, { unique: true });
adviceSchema.index({ notebookId: 1, moderationStatus: 1, createdAt: 1, _id: 1 });
export default mongoose.model('Advice', adviceSchema);
