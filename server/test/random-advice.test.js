import { afterEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import Advice from '../src/models/Advice.js';
import Notebook from '../src/models/Notebook.js';
import { random } from '../src/controllers/advice.js';

afterEach(() => vi.restoreAllMocks());
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });
describe('random advice safety', () => {
  it('filters approved public entries in the database and only returns allowlisted fields', async () => {
    const id = new mongoose.Types.ObjectId(), notebookId = new mongoose.Types.ObjectId();
    const aggregate = vi.spyOn(Advice, 'aggregate').mockResolvedValue([{ _id: id, notebookId, originalText: 'Hello', notebook: { title: 'Title', slug: 'slug', owner: 'private' }, moderationReason: 'private' }]);
    vi.spyOn(Advice, 'exists').mockResolvedValue(true); vi.spyOn(Notebook, 'exists').mockResolvedValue(true);
    const res = response(); await random({ query: {} }, res);
    const pipeline = aggregate.mock.calls[0][0];
    expect(pipeline[0].$match).toEqual({ moderationStatus: 'approved' });
    expect(pipeline).toContainEqual({ $match: { 'notebook.visibility': 'public' } });
    expect(pipeline).toContainEqual({ $sample: { size: 1 } });
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toMatch(/owner|moderation|private/);
  });
  it('falls back for a single entry and rejects invalid identifiers', async () => {
    const aggregate = vi.spyOn(Advice, 'aggregate').mockResolvedValue([]);
    const res = response(); await random({ query: { exclude: new mongoose.Types.ObjectId().toString() } }, res);
    expect(aggregate).toHaveBeenCalledTimes(2); expect(res.json).toHaveBeenCalledWith({ advice: null });
    await random({ query: { exclude: 'bad' } }, res); expect(res.status).toHaveBeenCalledWith(400);
  });
});
