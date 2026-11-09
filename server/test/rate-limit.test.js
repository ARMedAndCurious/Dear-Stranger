import { describe, expect, it } from 'vitest';
import request from 'supertest';
import session from 'express-session';
import { createApp } from '../src/app.js';

describe('anonymous submission rate limit', () => {
  it('returns 429 after ten attempts from the same IP', async () => {
    const app = createApp({ store: new session.MemoryStore(), secret: 'test-secret-at-least-thirty-two-characters', clientOrigin: 'http://localhost:5173' });
    const client = request.agent(app);
    const token = (await client.get('/api/auth/me')).body.csrfToken;
    let response;
    for (let i = 0; i < 11; i++) response = await client.post('/api/notebooks/example/advice').set('X-CSRF-Token', token).send({});
    expect(response.status).toBe(429);
  });
});
