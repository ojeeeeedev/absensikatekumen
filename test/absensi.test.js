import { describe, it, expect, vi, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { createMockRequest, createMockResponse } from './helpers.js';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
import { createClient } from '@supabase/supabase-js';
import handler from '../api/absensi.js';

const JWT_SECRET = 'test-jwt-secret-at-least-32-bytes-long';
const GAS_URL = 'https://gas.example/exec';
const originalEnv = { ...process.env };
const originalFetch = global.fetch;

const token = () => jwt.sign({ authorized: true }, JWT_SECRET, { algorithm: 'HS256' });
const jsonResponse = (value) => ({ text: vi.fn().mockResolvedValue(JSON.stringify(value)) });

describe('/api/absensi', () => {
  afterEach(() => {
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

  it('sets an HttpOnly HS256 session cookie for the configured login secret', async () => {
    configure();
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'POST', body: { action: 'login', secret: 'shared-secret' } }), res);
    expect(res.statusCode).toBe(200);
    const cookie = res.headers['Set-Cookie'];
    const encodedToken = cookie.match(/^auth_token=([^;]+)/)[1];
    expect(jwt.verify(decodeURIComponent(encodedToken), JWT_SECRET, { algorithms: ['HS256'] })).toMatchObject({ authorized: true });
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(res.body.token).toBeUndefined();
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
    expect(res.headers['Set-Cookie']).toBeUndefined();
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

  it('limits repeated failed logins from one forwarded address', async () => {
    configure();
    const headers = { 'x-forwarded-for': '203.0.113.42' };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = createMockResponse();
      await handler(createMockRequest({ method: 'POST', headers, body: { action: 'login', secret: 'wrong' } }), failed);
      expect(failed.statusCode).toBe(401);
    }

    const limited = createMockResponse();
    await handler(createMockRequest({ method: 'POST', headers, body: { action: 'login', secret: 'shared-secret' } }), limited);

    expect(limited.statusCode).toBe(429);
    expect(limited.headers['Retry-After']).toBeDefined();
  });

  it('validates an existing session cookie without exposing its token', async () => {
    configure();
    const res = createMockResponse();
    await handler(createMockRequest({
      method: 'POST',
      headers: { cookie: `auth_token=${token()}` },
      body: { action: 'session' },
    }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('rejects attendance without a session cookie or bearer token', async () => {
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

  it('returns 504 when GAS times out', async () => {
    configure();
    global.fetch = vi.fn().mockRejectedValue(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'POST', headers: { authorization: `Bearer ${token()}` }, body: { studentId: '1/SAB/2', week: 'R1' } }), res);
    expect(res.statusCode).toBe(504);
  });

  it('forwards configured GAS secret on valid attendance', async () => {
    configure();
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }));
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'POST', headers: { authorization: `Bearer ${token()}` }, body: { studentId: '1/SAB/2', week: 'R1' } }), res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).api_secret).toBe('gas-secret');
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
});
