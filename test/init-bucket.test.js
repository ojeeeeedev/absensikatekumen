import { describe, it, expect, vi, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { createMockRequest, createMockResponse } from './helpers.js';

// ---------------------------------------------------------------------------
// Mock @supabase/supabase-js so the test doesn't hit the network
// ---------------------------------------------------------------------------
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      storage: {
        createBucket: vi.fn(),
      },
    })),
  };
});

import { createClient } from '@supabase/supabase-js';
import handler from '../api/init-bucket.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const JWT_SECRET = 'test-secret';

function makeToken() {
  return jwt.sign({ authorized: true }, JWT_SECRET, { algorithm: 'HS256' });
}

function supabaseMock() {
  return createClient.mock.results[createClient.mock.results.length - 1]?.value;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('/api/init-bucket', () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalSupabaseKey = process.env.SUPABASE_KEY;

  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.SUPABASE_URL = originalSupabaseUrl;
    process.env.SUPABASE_KEY = originalSupabaseKey;
    vi.clearAllMocks();
  });

  // --- Method guards ---

  it('should handle OPTIONS with 200', async () => {
    const req = createMockRequest({ method: 'OPTIONS' });
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it('should return 405 for non-POST methods', async () => {
    const req = createMockRequest({ method: 'GET' });
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res.body.status).toBe('error');
  });

  // --- Auth guards ---

  it('should return 401 when Authorization header is missing', async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    const req = createMockRequest({ method: 'POST', body: { classCode: 'SAB' } });
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('should return 401 for an invalid token', async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    const req = createMockRequest({
      method: 'POST',
      headers: { authorization: 'Bearer bad-token' },
      body: { classCode: 'SAB' },
    });
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  // --- Input validation ---

  it('should return 400 when classCode is missing', async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_KEY = 'anon-key';
    const token = makeToken();
    const req = createMockRequest({
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: {},
    });
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/classCode/i);
  });

  it('should return 400 when classCode has invalid format', async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_KEY = 'anon-key';
    const token = makeToken();
    const req = createMockRequest({
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: { classCode: 'this-is-too-long-123' },
    });
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('should return 500 when Supabase env vars are missing', async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_KEY;
    const token = makeToken();
    const req = createMockRequest({
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: { classCode: 'SAB' },
    });
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
  });

  // --- Happy path: newly created ---

  it('should return 201 when the bucket is newly created', async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_KEY = 'anon-key';
    const token = makeToken();

    // Mock createBucket to simulate success (no error)
    createClient.mockReturnValueOnce({
      storage: { createBucket: vi.fn().mockResolvedValue({ error: null }) },
    });

    const req = createMockRequest({
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: { classCode: 'SAB' },
    });
    const res = createMockResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe('ok');
    expect(res.body.created).toBe(true);
    expect(res.body.bucketName).toBe('pasfoto-sab');
  });

  // --- Happy path: already existed ---

  it('should return 200 when the bucket already exists', async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_KEY = 'anon-key';
    const token = makeToken();

    // Mock createBucket to simulate "already exists" error
    createClient.mockReturnValueOnce({
      storage: {
        createBucket: vi.fn().mockResolvedValue({
          error: { message: 'Bucket already exists', status: 409 },
        }),
      },
    });

    const req = createMockRequest({
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: { classCode: 'sab' }, // lowercase — should still work
    });
    const res = createMockResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.created).toBe(false);
    expect(res.body.bucketName).toBe('pasfoto-sab');
  });

  // --- classCode normalisation ---

  it('should normalise classCode to uppercase and derive correct bucket name', async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_KEY = 'anon-key';
    const token = makeToken();

    createClient.mockReturnValueOnce({
      storage: { createBucket: vi.fn().mockResolvedValue({ error: null }) },
    });

    const req = createMockRequest({
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: { classCode: 'tom' }, // lowercase input
    });
    const res = createMockResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.bucketName).toBe('pasfoto-tom');
  });

  // --- Supabase unexpected error ---

  it('should return 500 when Supabase returns an unexpected error', async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_KEY = 'anon-key';
    const token = makeToken();

    createClient.mockReturnValueOnce({
      storage: {
        createBucket: vi.fn().mockResolvedValue({
          error: { message: 'Service unavailable', status: 503 },
        }),
      },
    });

    const req = createMockRequest({
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: { classCode: 'SAB' },
    });
    const res = createMockResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.status).toBe('error');
  });
});
