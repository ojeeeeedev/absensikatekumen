import { describe, it, expect, vi, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { createMockRequest, createMockResponse } from './helpers.js';

const list = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ storage: { from: vi.fn(() => ({ list })) } })),
}));

import handler from '../api/students.js';

const JWT_SECRET = 'test-jwt';
const GAS_URL = 'https://gas.example/students';
const originalEnv = { ...process.env };
const originalFetch = global.fetch;
const token = () => jwt.sign({ authorized: true }, JWT_SECRET, { algorithm: 'HS256' });

describe('/api/students', () => {
  afterEach(() => { process.env = { ...originalEnv }; if (originalFetch) global.fetch = originalFetch; else delete global.fetch; vi.restoreAllMocks(); vi.clearAllMocks(); });
  function configure() {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.VERCEL_SCRIPT_MAP_JSON = JSON.stringify({ SAB: GAS_URL });
    process.env.GAS_SECRET_KEY = 'gas-secret';
  }
  it('returns 401 without a bearer token', async () => {
    configure(); const res = createMockResponse();
    await handler(createMockRequest({ method: 'GET', query: { classCode: 'SAB' } }), res);
    expect(res.statusCode).toBe(401);
    expect(res.headers['Cache-Control']).toBe('private, no-store');
    expect(res.headers['Vercel-CDN-Cache-Control']).toBeUndefined();
  });
  it('accepts the existing login cookie', async () => {
    configure();
    global.fetch = vi.fn().mockResolvedValue({ text: vi.fn().mockResolvedValue(JSON.stringify({ status: 'ok', students: [] })) });
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'GET', headers: { cookie: `auth_token=${token()}` }, query: { classCode: 'SAB' } }), res);
    expect(res.statusCode).toBe(200);
  });
  it('rejects malformed class codes', async () => {
    configure(); const res = createMockResponse();
    await handler(createMockRequest({ method: 'GET', headers: { authorization: `Bearer ${token()}` }, query: { classCode: 'bad-class' } }), res);
    expect(res.statusCode).toBe(400);
  });
  it('returns names without creating a Supabase client', async () => {
    configure();
    global.fetch = vi.fn().mockResolvedValue({ text: vi.fn().mockResolvedValue(JSON.stringify({
      status: 'ok',
      students: [{ studentId: '1/SAB/2', name: 'Ada', dob: 'hidden', phone: '081234567890' }],
      meta: { rosterSource: 'cache', cachedAt: '2026-08-20T00:00:00.000Z' },
    })) });
    process.env.SUPABASE_URL = 'https://storage.example';
    process.env.SUPABASE_KEY = 'storage-key';
    const res = createMockResponse();

    await handler(createMockRequest({ method: 'GET', headers: { authorization: `Bearer ${token()}` }, query: { classCode: 'SAB', view: 'names' } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      students: [{ studentId: '1/SAB/2', name: 'Ada' }],
      meta: { rosterSource: 'cache', cachedAt: '2026-08-20T00:00:00.000Z' },
    });
    expect(list).not.toHaveBeenCalled();
    expect(res.headers['Cache-Control']).toBe('private, no-store');
  });

  it('rejects an unknown roster view', async () => {
    configure();
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'GET', headers: { authorization: `Bearer ${token()}` }, query: { classCode: 'SAB', view: 'unknown' } }), res);
    expect(res.statusCode).toBe(400);
  });
  it('rejects unmapped class codes without calling GAS', async () => {
    configure(); global.fetch = vi.fn(); const res = createMockResponse();
    await handler(createMockRequest({ method: 'GET', headers: { authorization: `Bearer ${token()}` }, query: { classCode: 'TOM' } }), res);
    expect(res.statusCode).toBe(400); expect(global.fetch).not.toHaveBeenCalled();
  });
  it('returns students from the configured GAS URL', async () => {
    configure();
    process.env.SUPABASE_URL = 'https://storage.example';
    process.env.SUPABASE_KEY = 'storage-key';
    list.mockResolvedValue({ data: [{ name: '1-SAB-2.jpg' }], error: null });
    global.fetch = vi.fn().mockResolvedValue({ text: vi.fn().mockResolvedValue(JSON.stringify({ status: 'ok', students: [{ studentId: '1/SAB/2', name: 'Ada', dob: '', kelasKi: '', katekisKk: '', phone: '081234567890' }] })) });
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'GET', headers: { authorization: `Bearer ${token()}` }, query: { classCode: 'sab' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.students).toEqual([{
      studentId: '1/SAB/2',
      name: 'Ada',
      dob: '',
      kelasKi: '',
      katekisKk: '',
      image: '/api/photo?studentId=1%2FSAB%2F2&filename=1-SAB-2.jpg',
    }]);
    expect(res.body.students[0]).not.toHaveProperty('phone');
    expect(list).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(GAS_URL, expect.any(Object));
    expect(res.headers['Cache-Control']).toBe('private, no-store');
    expect(res.headers['Vercel-CDN-Cache-Control']).toBeUndefined();
    expect(res.headers['Vercel-Cache-Tag']).toBeUndefined();
  });
  it('starts the photo listing before the GAS request completes', async () => {
    configure();
    process.env.SUPABASE_URL = 'https://storage.example';
    process.env.SUPABASE_KEY = 'storage-key';
    list.mockResolvedValue({ data: [], error: null });
    let resolveGas;
    global.fetch = vi.fn(() => new Promise(resolve => { resolveGas = resolve; }));
    const res = createMockResponse();

    const responsePromise = handler(createMockRequest({ method: 'GET', headers: { cookie: `auth_token=${token()}` }, query: { classCode: 'SAB' } }), res);
    expect(list).toHaveBeenCalledTimes(1);
    resolveGas({ text: vi.fn().mockResolvedValue(JSON.stringify({ status: 'ok', students: [] })) });
    await responsePromise;

    expect(res.statusCode).toBe(200);
  });
  it('returns 502 for non-JSON GAS responses', async () => {
    configure(); global.fetch = vi.fn().mockResolvedValue({ text: vi.fn().mockResolvedValue('not json') }); const res = createMockResponse();
    await handler(createMockRequest({ method: 'GET', headers: { authorization: `Bearer ${token()}` }, query: { classCode: 'SAB' } }), res);
    expect(res.statusCode).toBe(502);
  });

  it('forwards configured GAS secret in the student-list request', async () => {
    configure();
    global.fetch = vi.fn().mockResolvedValue({ text: vi.fn().mockResolvedValue(JSON.stringify({ status: 'ok', students: [] })) });
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'GET', headers: { authorization: `Bearer ${token()}` }, query: { classCode: 'SAB' } }), res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).api_secret).toBe('gas-secret');
  });

  it.each([undefined, ''])('fails closed before fetch when GAS_SECRET_KEY is %s', async (value) => {
    configure();
    if (value === undefined) delete process.env.GAS_SECRET_KEY; else process.env.GAS_SECRET_KEY = value;
    global.fetch = vi.fn();
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'GET', headers: { authorization: `Bearer ${token()}` }, query: { classCode: 'SAB' } }), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe('Server GAS authentication is not configured');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
