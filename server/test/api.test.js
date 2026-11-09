import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import session from 'express-session';
import { createApp } from '../src/app.js';
import User from '../src/models/User.js';
import Notebook from '../src/models/Notebook.js';
import Advice from '../src/models/Advice.js';
import crypto from 'node:crypto';

let mongo, app;
const credentials = { email: 'reader@example.com', password: 'verysecure123' };
const book = { title: 'A quiet place', description: 'Hello', visibility: 'unlisted' };
async function agent() { const client = request.agent(app); const response = await client.get('/api/auth/me'); return { client, token: response.body.csrfToken }; }
async function register(client, token, data = credentials) { return client.post('/api/auth/register').set('X-CSRF-Token', token).send(data); }
beforeAll(async () => { if (!process.env.TEST_MONGODB_URI) mongo = await MongoMemoryServer.create(); await mongoose.connect(process.env.TEST_MONGODB_URI || mongo.getUri(), { dbName: `dear_stranger_test_${crypto.randomBytes(8).toString('hex')}` }); await Promise.all([User.init(), Notebook.init(), Advice.init()]); app = createApp({ store: new session.MemoryStore(), secret: 'test-secret-at-least-thirty-two-characters', clientOrigin: 'http://localhost:5173' }); }, 180000);
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });
beforeEach(async () => { await User.deleteMany(); await Notebook.deleteMany(); await Advice.deleteMany(); });
describe('foundation API', () => {
  it('stores optional notebook categories and keeps older uncategorized notebooks discoverable', async () => {
    const owner = await agent(); const signup = await register(owner.client, owner.token);
    const created = await owner.client.post('/api/notebooks').set('X-CSRF-Token', signup.body.csrfToken).send({ ...book, visibility: 'public', category: 'Family' });
    expect(created.status).toBe(201);
    expect((await Notebook.findOne({ slug: created.body.notebook.slug })).category).toBe('Family');
    expect((await owner.client.post('/api/notebooks').set('X-CSRF-Token', signup.body.csrfToken).send({ ...book, visibility: 'public', category: 'secret' })).status).toBe(400);
    const older = await Notebook.create({ ...book, owner: signup.body.user.id, slug: 'older-book', visibility: 'public' });
    const filtered = await request(app).get('/api/notebooks/discover/list?category=Family');
    expect(filtered.body.notebooks.map(n => n.slug)).toEqual([created.body.notebook.slug]);
    const uncategorized = await request(app).get('/api/notebooks/discover/list?category=Uncategorized');
    expect(uncategorized.body.notebooks.map(n => n.slug)).toContain(older.slug);
    expect((await request(app).get('/api/notebooks/discover/list?category=Family&search=nope')).body.total).toBe(0);
    expect((await request(app).get('/api/notebooks/discover/list?category=Family&page=2')).body.notebooks).toHaveLength(0);
    expect((await request(app).get('/api/notebooks/discover/list?category=invalid')).status).toBe(400);
  });
  it('registers, persists a session, logs out and logs back in', async () => {
    const { client, token } = await agent(); const signup = await register(client, token); expect(signup.status).toBe(200); expect(signup.body.user.email).toBe(credentials.email); expect(JSON.stringify(signup.body)).not.toContain('password');
    expect((await client.get('/api/auth/me')).body.user.email).toBe(credentials.email);
    expect((await client.post('/api/auth/logout').set('X-CSRF-Token', signup.body.csrfToken)).status).toBe(200);
    const fresh = await client.get('/api/auth/me'); expect(fresh.body.user).toBeNull();
    expect((await client.post('/api/auth/login').set('X-CSRF-Token', fresh.body.csrfToken).send(credentials)).status).toBe(200);
  });
  it('rejects invalid credentials', async () => { const { client, token } = await agent(); await register(client, token); const fresh = await client.get('/api/auth/me'); const result = await client.post('/api/auth/login').set('X-CSRF-Token', fresh.body.csrfToken).send({ ...credentials, password: 'wrong' }); expect(result.status).toBe(401); });
  it('requires authentication and CSRF protection', async () => { const { client, token } = await agent(); expect((await client.post('/api/notebooks').set('X-CSRF-Token', token).send(book)).status).toBe(401); expect((await client.post('/api/auth/register').send(credentials)).status).toBe(403); });
  it('creates unique generated slugs for simultaneous notebooks', async () => { const { client, token } = await agent(); const signup = await register(client, token); const csrf = signup.body.csrfToken; const responses = await Promise.all([1, 2].map(() => client.post('/api/notebooks').set('X-CSRF-Token', csrf).send(book))); expect(responses.map(r => r.status)).toEqual([201, 201]); expect(responses[0].body.notebook.slug).toMatch(/^a-quiet-place-[a-f0-9]{10}$/); expect(responses[0].body.notebook.slug).not.toBe(responses[1].body.notebook.slug); });
  it('exposes public and unlisted notebooks by link without owner information or a discovery endpoint', async () => { const { client, token } = await agent(); const signup = await register(client, token); for (const visibility of ['public', 'unlisted']) { const created = await client.post('/api/notebooks').set('X-CSRF-Token', signup.body.csrfToken).send({ ...book, visibility }); const result = await request(app).get(`/api/notebooks/${created.body.notebook.slug}`); expect(result.status).toBe(200); expect(result.body.notebook.visibility).toBe(visibility); expect(result.body.notebook).not.toHaveProperty('owner'); expect(JSON.stringify(result.body)).not.toContain(credentials.email); } expect((await request(app).get('/api/notebooks')).status).toBe(404); });
  it('allows only the owner to edit', async () => { const owner = await agent(); const signup = await register(owner.client, owner.token); const created = await owner.client.post('/api/notebooks').set('X-CSRF-Token', signup.body.csrfToken).send(book); const id = created.body.notebook.id; const other = await agent(); const otherSignup = await register(other.client, other.token, { email: 'other@example.com', password: 'anotherpassword' }); expect((await other.client.patch(`/api/notebooks/${id}`).set('X-CSRF-Token', otherSignup.body.csrfToken).send({ title: 'Stolen' })).status).toBe(404); const updated = await owner.client.patch(`/api/notebooks/${id}`).set('X-CSRF-Token', signup.body.csrfToken).send({ title: 'Changed', description: 'New' }); expect(updated.status).toBe(200); expect(updated.body.notebook.title).toBe('Changed'); });
  it('validates input and handles invalid identifiers and missing notebooks', async () => { const { client, token } = await agent(); expect((await register(client, token, { email: 'bad', password: 'x' })).status).toBe(400); const signup = await register(client, token); expect((await client.post('/api/notebooks').set('X-CSRF-Token', signup.body.csrfToken).send({ ...book, slug: 'BAD SLUG' })).status).toBe(400); expect((await client.patch('/api/notebooks/not-an-id').set('X-CSRF-Token', signup.body.csrfToken).send({ title: 'ok' })).status).toBe(400); expect((await client.get('/api/notebooks/missing')).status).toBe(404); });
  it('still serves an existing notebook using its original slug', async () => { const { client, token } = await agent(); const signup = await register(client, token); const existing = await Notebook.create({ ...book, slug: 'old-link', owner: signup.body.user.id }); expect((await request(app).get(`/api/notebooks/${existing.slug}`)).status).toBe(200); });
});

describe('advice API', () => {
  it('selects only approved public advice across notebooks, avoids repeats and returns cached translations safely', async () => {
    const owner1 = new mongoose.Types.ObjectId(), owner2 = new mongoose.Types.ObjectId();
    const [one, two, hidden] = await Notebook.create([
      { owner: owner1, title: 'First', slug: 'first', visibility: 'public' },
      { owner: owner2, title: 'Second', slug: 'second', visibility: 'public' },
      { owner: owner1, title: 'Hidden', slug: 'hidden', visibility: 'unlisted' },
    ]);
    const make = (notebookId, originalText, moderationStatus, extra = {}) => ({ notebookId, originalText, moderationStatus, submissionId: crypto.randomUUID(), moderationReason: 'private review', ...extra });
    const [a, b] = await Advice.create([
      make(one._id, 'First approved', 'approved', { originalLanguage: 'en', translations: { hi: 'संदेश' } }),
      make(two._id, 'Second approved', 'approved'),
      make(hidden._id, 'Secret', 'approved'), make(one._id, 'Pending', 'pending'), make(two._id, 'Rejected', 'rejected'),
    ]);
    const first = await request(app).get(`/api/advice/random?exclude=${a._id}`);
    expect(first.status).toBe(200); expect(first.body.advice.id).toBe(String(b._id));
    const next = await request(app).get(`/api/advice/random?exclude=${b._id}&language=hi`);
    expect(next.body.advice.id).toBe(String(a._id)); expect(next.body.advice.translatedText).toBe('संदेश');
    expect(JSON.stringify(next.body)).not.toMatch(/owner|moderation|submission|email|Secret|Pending|Rejected/);
    expect((await request(app).get('/api/advice/random?exclude=bad')).status).toBe(400);
    await Advice.deleteOne({ _id: b._id });
    expect((await request(app).get(`/api/advice/random?exclude=${a._id}`)).body.advice.id).toBe(String(a._id));
    await Advice.deleteOne({ _id: a._id });
    expect((await request(app).get('/api/advice/random')).body.advice).toBeNull();
  });
  it('discovers explicitly public older notebooks across owners without leaking unlisted or missing-visibility records', async () => {
    const owner1 = new mongoose.Types.ObjectId(), owner2 = new mongoose.Types.ObjectId();
    await Notebook.collection.insertMany([
      { owner: owner1, title: 'Older public', slug: 'old-public', visibility: 'public' },
      { owner: owner2, title: 'Another public', slug: 'other-public', visibility: 'public', createdAt: new Date() },
      { owner: owner2, title: 'Private link', slug: 'private-link', visibility: 'unlisted' },
      { owner: owner1, title: 'Unknown visibility', slug: 'unknown-visibility' },
    ]);
    const response = await request(app).get('/api/notebooks/discover/list');
    expect(response.status).toBe(200);
    expect(response.body.notebooks.map(item => item.slug).sort()).toEqual(['old-public', 'other-public']);
    expect(JSON.stringify(response.body)).not.toContain('owner');
  });
  it('discovers only public notebooks, with title search and pagination', async () => { const owner = await agent(); const signup = await register(owner.client, owner.token); const csrf = signup.body.csrfToken; for (let i = 0; i < 13; i++) await owner.client.post('/api/notebooks').set('X-CSRF-Token', csrf).send({ title: `Public ${i}`, visibility: 'public' }); await owner.client.post('/api/notebooks').set('X-CSRF-Token', csrf).send({ title: 'Hidden public', visibility: 'unlisted' }); const first = await request(app).get('/api/notebooks/discover/list?search=public&page=1'); expect(first.status).toBe(200); expect(first.body.total).toBe(13); expect(first.body.notebooks).toHaveLength(12); expect(JSON.stringify(first.body)).not.toContain('Hidden'); expect((await request(app).get('/api/notebooks/discover/list?search=public&page=2')).body.notebooks).toHaveLength(1); });
  it('supports anonymous retry, owner review, public pagination and cross-notebook isolation', async () => {
    const owner = await agent(); const signup = await register(owner.client, owner.token); const csrf = signup.body.csrfToken;
    const first = (await owner.client.post('/api/notebooks').set('X-CSRF-Token', csrf).send(book)).body.notebook;
    const second = (await owner.client.post('/api/notebooks').set('X-CSRF-Token', csrf).send(book)).body.notebook;
    const visitor = await agent(); const body = { text: '<script>alert(1)</script> Please be kind to yourself.', submissionId: crypto.randomUUID() };
    const send = () => visitor.client.post(`/api/notebooks/${first.slug}/advice`).set('X-CSRF-Token', visitor.token).send(body);
    expect((await send()).status).toBe(201); expect((await send()).status).toBe(200);
    expect(await Advice.countDocuments({})).toBe(1);
    expect((await request(app).get(`/api/notebooks/${first.slug}/advice`)).body.total).toBe(0);
    const entries = await owner.client.get(`/api/notebooks/manage/${first.id}/advice`); const entry = entries.body.advice[0];
    const stranger = await agent(); const strangerSignup = await register(stranger.client, stranger.token, { email: 'second@example.com', password: 'anotherpassword' });
    expect((await stranger.client.patch(`/api/notebooks/manage/${first.id}/advice/${entry._id}`).set('X-CSRF-Token', strangerSignup.body.csrfToken).send({ action: 'approve' })).status).toBe(404);
    expect((await owner.client.patch(`/api/notebooks/manage/${second.id}/advice/${entry._id}`).set('X-CSRF-Token', csrf).send({ action: 'approve' })).status).toBe(404);
    expect((await owner.client.patch(`/api/notebooks/manage/${first.id}/advice/${entry._id}`).set('X-CSRF-Token', csrf).send({ action: 'approve' })).status).toBe(200);
    const visible = await request(app).get(`/api/notebooks/${first.slug}/advice?page=1`); expect(visible.body.total).toBe(1); expect(visible.body.advice.originalText).toBe(body.text); expect(visible.body.advice).not.toHaveProperty('moderationStatus'); expect((await request(app).get(`/api/notebooks/${first.slug}/advice?page=2`)).body.advice).toBeNull();
    expect((await owner.client.patch(`/api/notebooks/manage/${first.id}/advice/${entry._id}`).set('X-CSRF-Token', csrf).send({ action: 'remove' })).status).toBe(200);
    expect((await request(app).get(`/api/notebooks/${first.slug}/advice`)).body.total).toBe(0);
  });
});
