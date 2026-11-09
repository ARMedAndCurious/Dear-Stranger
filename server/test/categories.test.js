import { describe, expect, it } from 'vitest';
import Notebook from '../src/models/Notebook.js';
import { createNotebookSchema, updateNotebookSchema } from '../src/validation/schemas.js';

describe('notebook categories', () => {
  it('accepts optional genres without changing visibility or old notebooks', () => {
    const input = { title: 'Notebook', visibility: 'unlisted' };
    expect(createNotebookSchema.parse(input)).not.toHaveProperty('category');
    const categorized = createNotebookSchema.parse({ ...input, category: 'Family' });
    expect(categorized).toMatchObject({ category: 'Family', visibility: 'unlisted' });
    expect(new Notebook({ ...categorized, owner: '507f1f77bcf86cd799439011', slug: 'book' }).category).toBe('Family');
    expect(new Notebook({ ...input, owner: '507f1f77bcf86cd799439011', slug: 'old-book' }).category).toBeUndefined();
  });
  it('rejects unknown categories and allows owners to clear an existing category', () => {
    expect(createNotebookSchema.safeParse({ title: 'Notebook', visibility: 'public', category: 'Unknown' }).success).toBe(false);
    expect(updateNotebookSchema.safeParse({ category: 'Unknown' }).success).toBe(false);
    expect(updateNotebookSchema.parse({ category: null })).toEqual({ category: null });
  });
});
