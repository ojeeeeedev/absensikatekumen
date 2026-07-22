import { describe, it, expect, vi, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { createMockRequest, createMockResponse } from './helpers.js';

const list = vi.fn();
const download = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({ list, download })),
    },
  })),
}));

import handler from '../api/photo.js';

const JWT_SECRET = 'test-secret';

function makeToken() {
  return jwt.sign({ authorized: true }, JWT_SECRET, { algorithm: 'HS256' });
}

describe('/api/photo', () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalSupabaseKey = process.env.SUPABASE_KEY;

  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.SUPABASE_URL = originalSupabaseUrl;
    process.env.SUPABASE_KEY = originalSupabaseKey;
    vi.clearAllMocks();
  });

  it('requires a valid token', async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    const req = createMockRequest({ method: 'GET', query: { studentId: '2025/SAB/001' } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
  });

  it('rejects malformed student IDs', async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    const req = createMockRequest({
      method: 'GET',
      headers: { cookie: `auth_token=${makeToken()}` },
      query: { studentId: '../bad' },
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
  });

  it('streams a private storage object through the app server', async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_KEY = 'service-key';

    list.mockResolvedValue({
      data: [{ name: '2025-SAB-001.jpg' }],
      error: null,
    });
    download.mockResolvedValue({
      data: new Blob(['photo-bytes'], { type: 'image/jpeg' }),
      error: null,
    });

    const req = createMockRequest({
      method: 'GET',
      headers: { cookie: `auth_token=${makeToken()}` },
      query: { studentId: '2025/SAB/001' },
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('image/jpeg');
    expect(res.headers['Cache-Control']).toBe('private, no-store');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.toString()).toBe('photo-bytes');
  });

  it('downloads roster photos without another storage list request', async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_KEY = 'service-key';
    download.mockResolvedValue({ data: new Blob(['photo-bytes']), error: null });

    for (const id of ['001', '002', '003']) {
      const studentId = `2025/SAB/${id}`;
      const req = createMockRequest({
        method: 'GET',
        headers: { cookie: `auth_token=${makeToken()}` },
        query: { studentId, filename: `2025-SAB-${id}.jpg` },
      });
      const res = createMockResponse();
      await handler(req, res);
      expect(res.statusCode).toBe(200);
    }

    expect(list).not.toHaveBeenCalled();
    expect(download).toHaveBeenCalledTimes(3);
  });

  it('rejects a filename that does not belong to the student', async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_KEY = 'service-key';
    const req = createMockRequest({
      method: 'GET',
      headers: { cookie: `auth_token=${makeToken()}` },
      query: { studentId: '2025/SAB/001', filename: '2025-SAB-002.jpg' },
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(download).not.toHaveBeenCalled();
  });
});
