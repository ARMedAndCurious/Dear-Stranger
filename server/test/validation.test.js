import { describe, expect, it } from 'vitest';
import { createNotebookSchema, registerSchema, updateNotebookSchema } from '../src/validation/schemas.js';
describe('request validation', () => {
  it('normalizes email and rejects oversized UTF-8 passwords', () => { expect(registerSchema.parse({ email: ' READER@example.com ', password: 'password123' }).email).toBe('reader@example.com'); expect(registerSchema.safeParse({ email: 'a@b.com', password: '🔒'.repeat(20) }).success).toBe(false); });
  it('rejects client-provided slugs and disallows updates to owner or visibility', () => { expect(createNotebookSchema.safeParse({ title: 'Hello', slug: 'invalid slug', visibility: 'public' }).success).toBe(false); expect(createNotebookSchema.safeParse({ title: 'Hello', visibility: 'public' }).success).toBe(true); expect(updateNotebookSchema.safeParse({ owner: 'someone', visibility: 'public' }).success).toBe(false); });
});
