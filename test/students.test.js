import { describe, it, expect, vi, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { createMockRequest, createMockResponse } from './helpers.js';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
import handler from '../api/students.js';

const JWT_SECRET = 'test-jwt-secret-at-least-32-characters';
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
  });
  it('rejects malformed class codes', async () => {
    configure(); const res = createMockResponse();
    await handler(createMockRequest({ method: 'GET', headers: { authorization: `Bearer ${token()}` }, query: { classCode: 'bad-class' } }), res);
    expect(res.statusCode).toBe(400);
  });
  it('rejects unmapped class codes without calling GAS', async () => {
    configure(); global.fetch = vi.fn(); const res = createMockResponse();
    await handler(createMockRequest({ method: 'GET', headers: { authorization: `Bearer ${token()}` }, query: { classCode: 'TOM' } }), res);
    expect(res.statusCode).toBe(400); expect(global.fetch).not.toHaveBeenCalled();
  });
  it('returns students from the configured GAS URL', async () => {
    configure(); global.fetch = vi.fn().mockResolvedValue({ text: vi.fn().mockResolvedValue(JSON.stringify({ status: 'ok', students: [{ studentId: '1/SAB/2' }] })) });
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'GET', headers: { authorization: `Bearer ${token()}` }, query: { classCode: 'sab' } }), res);
    expect(res.statusCode).toBe(200); expect(res.body.students).toHaveLength(1); expect(global.fetch).toHaveBeenCalledWith(GAS_URL, expect.any(Object));
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
