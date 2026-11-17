import { describe, it, expect, vi, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { createMockRequest, createMockResponse } from './helpers.js';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
import { createClient } from '@supabase/supabase-js';
import handler, { resetLoginThrottleForTests } from '../api/absensi.js';

const JWT_SECRET = 'test-jwt';
const GAS_URL = 'https://gas.example/exec';
const originalEnv = { ...process.env };
const originalFetch = global.fetch;

const token = () => jwt.sign({ authorized: true }, JWT_SECRET, { algorithm: 'HS256' });
const jsonResponse = (value) => ({ text: vi.fn().mockResolvedValue(JSON.stringify(value)) });

describe('/api/absensi', () => {
  afterEach(() => {
    resetLoginThrottleForTests();
    process.env = { ...originalEnv };
    if (originalFetch) global.fetch = originalFetch; else delete global.fetch;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  function configure() {
    process.env.AUTH_SECRET = 'shared-secret';
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.VERCEL_SCRIPT_MAP_JSON = JSON.stringify({ SAB: GAS_URL });
    process.env.GAS_SECRET_KEY = 'gas-secret';
  }

  const sessionCookieFrom = res => decodeURIComponent(String(res.headers['Set-Cookie']).match(/^auth_token=([^;]*)/)[1]);

  it('issues the HS256 token only as an HttpOnly cookie and returns its expiry', async () => {
    configure();
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'POST', headers: { 'x-forwarded-proto': 'https' }, body: { action: 'login', secret: 'shared-secret' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeUndefined();
    const payload = jwt.verify(sessionCookieFrom(res), JWT_SECRET, { algorithms: ['HS256'] });
    expect(payload).toMatchObject({ authorized: true });
    expect(payload.exp - payload.iat).toBe(3600);
    expect(res.body.expiresAt).toBe(payload.exp);
    expect(res.headers['Set-Cookie']).toMatch(/; HttpOnly; SameSite=Lax; Secure$/);
    expect(res.headers['Set-Cookie']).toMatch(/Max-Age=3600/);
  });

  it('omits Secure on plain-HTTP local development so the cookie still works', async () => {
    configure();
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'POST', body: { action: 'login', secret: 'shared-secret' } }), res);
    expect(res.headers['Set-Cookie']).toMatch(/HttpOnly; SameSite=Lax$/);
  });

  it('accepts attendance authenticated by the session cookie alone', async () => {
    configure();
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }));
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'POST', headers: { cookie: `auth_token=${token()}` }, body: { studentId: '1/SAB/2', week: '3' } }), res);
    expect(res.statusCode).toBe(200);
  });

  it('logs out by expiring the cookie and clearing cached photos', async () => {
    configure();
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'POST', body: { action: 'logout' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Set-Cookie']).toMatch(/^auth_token=; Path=\/; Max-Age=0; HttpOnly/);
    expect(res.headers['Clear-Site-Data']).toBe('"cache"');
  });

  it('does not load attendance services during login', async () => {
    configure();
    delete process.env.VERCEL_SCRIPT_MAP_JSON;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_KEY = 'service-key';
    const res = createMockResponse();

    await handler(createMockRequest({ method: 'POST', body: { action: 'login', secret: 'shared-secret' } }), res);

    expect(res.statusCode).toBe(200);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('fails closed when AUTH_SECRET is missing', async () => {
    configure();
    delete process.env.AUTH_SECRET;
    global.fetch = vi.fn();
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'POST', body: { action: 'login', secret: '' } }), res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ status: 'error' });
    expect(res.body.message).toBe('Server authentication is not configured');
    expect(res.body.token).toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('fails closed when JWT_SECRET is missing', async () => {
    configure();
    delete process.env.JWT_SECRET;
    global.fetch = vi.fn();
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'POST', body: { action: 'login', secret: 'shared-secret' } }), res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ status: 'error' });
    expect(res.body.message).toBe('Server authentication is not configured');
    expect(res.body.token).toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('rejects a wrong login secret without calling GAS', async () => {
    configure();
    global.fetch = vi.fn();
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'POST', body: { action: 'login', secret: 'wrong' } }), res);
    expect(res.statusCode).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects attendance without a bearer token', async () => {
    configure();
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'POST', body: { studentId: '1/SAB/2', week: 'R1' } }), res);
    expect(res.statusCode).toBe(401);
  });

  it('rejects malformed student IDs before calling GAS', async () => {
    configure();
    global.fetch = vi.fn();
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'POST', headers: { authorization: `Bearer ${token()}` }, body: { studentId: 'bad', week: 'R1' } }), res);
    expect(res.statusCode).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('forwards valid authenticated attendance to the mapped GAS URL', async () => {
    configure();
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok', studentId: '1/SAB/2' }));
    const req = createMockRequest({ method: 'POST', headers: { authorization: `Bearer ${token()}` }, body: { studentId: '1/SAB/2', week: 'R1' } });
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(global.fetch).toHaveBeenCalledWith(GAS_URL, expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({ studentId: '1/SAB/2', api_secret: 'gas-secret' });
  });

  it('returns 502 when GAS returns non-JSON', async () => {
    configure();
    global.fetch = vi.fn().mockResolvedValue({ text: vi.fn().mockResolvedValue('<html>error</html>') });
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'POST', headers: { authorization: `Bearer ${token()}` }, body: { studentId: '1/SAB/2', week: 'R1' } }), res);
    expect(res.statusCode).toBe(502);
  });

  it('forwards configured GAS secret on valid attendance', async () => {
    configure();
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }));
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'POST', headers: { authorization: `Bearer ${token()}` }, body: { studentId: '1/SAB/2', week: 'R1' } }), res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).api_secret).toBe('gas-secret');
  });

  const attend = async (body, gasReply = { status: 'ok' }) => {
    configure();
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(gasReply));
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'POST', headers: { authorization: `Bearer ${token()}` }, body }), res);
    return res;
  };

  it('forwards only studentId, week and the GAS secret (no client-chosen action)', async () => {
    await attend({ studentId: '1/SAB/2', week: 'R1', action: 'getStudentContact', extra: 'x' });
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ studentId: '1/SAB/2', week: 'R1', api_secret: 'gas-secret' });
  });

  it.each([
    [{ studentId: ['1/SAB/2'], week: 'R1' }],
    [{ studentId: `1/SAB/${'9'.repeat(80)}`, week: 'R1' }],
    [{ studentId: '1/SAB/2', week: 'Nama' }],
    [{ studentId: '1/SAB/2' }],
  ])('rejects invalid attendance input %j before calling GAS', async (body) => {
    const res = await attend(body);
    expect(res.statusCode).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('never passes the raw sheet image value through', async () => {
    const res = await attend({ studentId: '1/SAB/2', week: '3' }, { status: 'ok', image: 'https://drive.example/private' });
    expect(res.body.image).toBeUndefined();
  });

  it.each([
    [{ status: 'busy', message: 'x' }],
    [{ status: 'error', message: 'Sistem sedang sibuk, silakan scan ulang.' }],
  ])('maps GAS lock contention %j to a retryable 503', async (reply) => {
    const res = await attend({ studentId: '1/SAB/2', week: '3' }, reply);
    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe('busy');
  });

  it('replaces internal GAS error text with a generic message', async () => {
    const res = await attend({ studentId: '1/SAB/2', week: '3' }, { status: 'error', message: 'Internal: TypeError at Code.js' });
    expect(res.body).toEqual({ status: 'error', message: 'Gagal mencatat presensi' });
  });

  it('returns 504 without leaking details when GAS cannot be reached', async () => {
    configure();
    global.fetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1'));
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'POST', headers: { authorization: `Bearer ${token()}` }, body: { studentId: '1/SAB/2', week: '3' } }), res);
    expect(res.statusCode).toBe(504);
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
  });

  it.each([undefined, ''])('fails closed before fetch when GAS_SECRET_KEY is %s', async (value) => {
    configure();
    if (value === undefined) delete process.env.GAS_SECRET_KEY; else process.env.GAS_SECRET_KEY = value;
    global.fetch = vi.fn();
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'POST', headers: { authorization: `Bearer ${token()}` }, body: { studentId: '1/SAB/2', week: 'R1' } }), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe('Server GAS authentication is not configured');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('blocks an IP after repeated wrong passwords, without affecting other IPs', async () => {
    configure();
    vi.useFakeTimers();
    try {
      const attempt = async (ip, secret = 'wrong') => {
        const res = createMockResponse();
        const pending = handler(createMockRequest({ method: 'POST', headers: { 'x-real-ip': ip }, body: { action: 'login', secret } }), res);
        await vi.runAllTimersAsync();
        await pending;
        return res;
      };
      for (let i = 0; i < 10; i++) expect((await attempt('203.0.113.7')).statusCode).toBe(401);
      const blocked = await attempt('203.0.113.7', 'shared-secret');
      expect(blocked.statusCode).toBe(429);
      expect(Number(blocked.headers['Retry-After'])).toBeGreaterThan(0);
      expect((await attempt('198.51.100.2', 'shared-secret')).statusCode).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });
});
