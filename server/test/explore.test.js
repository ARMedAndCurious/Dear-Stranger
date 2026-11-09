import { afterEach, describe, expect, it, vi } from 'vitest';
import Notebook from '../src/models/Notebook.js';
import Advice from '../src/models/Advice.js';
import { explore } from '../src/controllers/notebooks.js';

afterEach(() => vi.restoreAllMocks());
describe('public discovery query', () => {
  it('combines category, search and pagination without exposing unlisted notebooks', async () => {
    const count = vi.spyOn(Notebook, 'countDocuments').mockResolvedValue(0);
    const find = vi.spyOn(Notebook, 'find').mockReturnValue({ select: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [] }) }) }) }) });
    vi.spyOn(Advice, 'aggregate').mockResolvedValue([]);
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
    await explore({ query: { category: 'Family', search: 'Care', page: '2' } }, res);
    const filter = { visibility: 'public', category: 'Family', title: { $regex: 'Care', $options: 'i' } };
    expect(find).toHaveBeenCalledWith(filter); expect(count).toHaveBeenCalledWith(filter);
    await explore({ query: { category: 'Uncategorized' } }, res);
    expect(find).toHaveBeenLastCalledWith({ visibility: 'public', category: { $exists: false } });
    await explore({ query: { category: 'not-a-category' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
  it('uses public visibility without an owner filter, including for anonymous visitors', async () => {
    const count = vi.spyOn(Notebook, 'countDocuments').mockResolvedValue(13);
    const result = [{ _id: 'one', slug: 'first', title: 'First' }, { _id: 'two', slug: 'second', title: 'Second' }];
    const skip = vi.fn().mockReturnValue({ limit: () => ({ lean: async () => result }) });
    const find = vi.spyOn(Notebook, 'find').mockReturnValue({ select: () => ({ sort: () => ({ skip }) }) });
    vi.spyOn(Advice, 'aggregate').mockResolvedValue([{ _id: 'one', count: 2 }]);
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
    await explore({ query: { page: '2' } }, res);
    expect(find).toHaveBeenCalledWith({ visibility: 'public' });
    expect(count).toHaveBeenCalledWith({ visibility: 'public' });
    expect(skip).toHaveBeenCalledWith(12);
    expect(res.json.mock.calls[0][0]).toMatchObject({ page: 2, total: 13, notebooks: [{ slug: 'first', approvedCount: 2 }, { slug: 'second', approvedCount: 0 }] });
  });
  it('escapes search terms and rejects invalid pagination', async () => {
    vi.spyOn(Notebook, 'countDocuments').mockResolvedValue(0);
    const find = vi.spyOn(Notebook, 'find').mockReturnValue({ select: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [] }) }) }) }) });
    vi.spyOn(Advice, 'aggregate').mockResolvedValue([]);
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
    await explore({ query: { search: '.*', page: '1' } }, res);
    expect(find.mock.calls[0][0]).toEqual({ visibility: 'public', title: { $regex: '\\.\\*', $options: 'i' } });
    await explore({ query: { page: '0' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
