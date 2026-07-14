import { describe, it, expect, vi, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { createMockRequest, createMockResponse } from './helpers.js';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
import { createClient } from '@supabase/supabase-js';
import handler from '../api/absensi.js';

const JWT_SECRET = 'test-jwt-secret-at-least-32-characters';
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

  it('sets an HttpOnly session cookie without exposing the token body', async () => {
    configure();
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'POST', body: { action: 'login', secret: 'shared-secret' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    const cookie = res.headers['Set-Cookie'];
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Max-Age=3600');
    const signedToken = decodeURIComponent(cookie.match(/^auth_token=([^;]+)/)[1]);
    expect(jwt.verify(signedToken, JWT_SECRET, { algorithms: ['HS256'] })).toMatchObject({ authorized: true });
    expect(res.body.token).toBeUndefined();
  });

  it('validates and clears cookie sessions', async () => {
    configure();
    const signedToken = token();
    const sessionRes = createMockResponse();
    await handler(createMockRequest({ method: 'POST', headers: { cookie: `auth_token=${signedToken}` }, body: { action: 'session' } }), sessionRes);
    expect(sessionRes.statusCode).toBe(200);

    const logoutRes = createMockResponse();
    await handler(createMockRequest({ method: 'POST', body: { action: 'logout' } }), logoutRes);
    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes.headers['Set-Cookie']).toContain('Max-Age=0');
    expect(logoutRes.headers['Set-Cookie']).toContain('HttpOnly');
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

  it('fails closed when authentication secrets are below the minimum length', async () => {
    configure();
    process.env.AUTH_SECRET = 'too-short';
    process.env.JWT_SECRET = 'also-too-short';
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'POST', body: { action: 'login', secret: 'too-short' } }), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe('Server authentication is not configured');
    expect(res.headers['Set-Cookie']).toBeUndefined();
  });

  it('rejects a correctly signed token without the authorized claim', async () => {
    configure();
    const signedToken = jwt.sign({ role: 'facilitator' }, JWT_SECRET, { algorithm: 'HS256' });
    const res = createMockResponse();
    await handler(createMockRequest({
      method: 'POST',
      headers: { cookie: `auth_token=${signedToken}` },
      body: { action: 'session' },
    }), res);
    expect(res.statusCode).toBe(401);
  });

  it('rejects a wrong login secret without calling GAS', async () => {
    configure();
    global.fetch = vi.fn();
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'POST', body: { action: 'login', secret: 'wrong' } }), res);
    expect(res.statusCode).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rate limits repeated failed logins on the deployed handler path', async () => {
    configure();
    const statuses = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const res = createMockResponse();
      await handler(createMockRequest({
        method: 'POST',
        headers: { 'x-forwarded-for': '198.51.100.25' },
        body: { action: 'login', secret: `wrong-${attempt}` },
      }), res);
      statuses.push(res.statusCode);
      if (attempt === 5) expect(res.headers['Retry-After']).toBeDefined();
    }
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
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
