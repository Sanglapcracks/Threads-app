import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/config/clerk.js', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  clerkClient: {},
  getAuth: () => ({ userId: null }),
  requireAuthApi: (
    _req: unknown,
    res: { status: (n: number) => { json: (b: unknown) => void } }
  ) => res.status(401).json({ error: 'unauthorized' }),
}));

import { createApp } from '../src/app.js';

describe('api basics', () => {
  const app = createApp();

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('unknown route returns 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('protected route without login returns 401', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
  });
});