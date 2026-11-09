import { z } from 'zod';

const email = z.string().trim().email().max(254).transform(value => value.toLowerCase());
const passwordBytes = value => Buffer.byteLength(value, 'utf8') <= 72;
export const registerSchema = z.object({ email, password: z.string().min(8).max(72).refine(passwordBytes, 'Password must be at most 72 UTF-8 bytes') }).strict();
export const loginSchema = z.object({ email, password: z.string().min(1).max(72).refine(passwordBytes, 'Password must be at most 72 UTF-8 bytes') }).strict();
const title = z.string().trim().min(1).max(100);
const description = z.string().trim().max(1000);
export const createNotebookSchema = z.object({ title, description: description.default(''), visibility: z.enum(['public', 'unlisted']) }).strict();
export const updateNotebookSchema = z.object({ title: title.optional(), description: description.optional() }).strict().refine(value => Object.keys(value).length > 0, 'Provide a title or description');
export const adviceSchema = z.object({ text: z.string().trim().min(15, 'Please write at least 15 characters').max(1500, 'Please keep your advice under 1500 characters'), submissionId: z.string().uuid(), originalLanguage: z.enum(['en', 'hi', 'kn', 'ta', 'bn', 'gu', 'ml', 'mr', 'pa', 'te']).nullable().optional() }).strict();
export const moderationActionSchema = z.object({ action: z.enum(['approve', 'reject', 'remove']) }).strict();
