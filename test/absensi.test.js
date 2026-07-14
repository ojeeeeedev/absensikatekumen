import { describe, it, expect, vi, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { createMockRequest, createMockResponse } from './helpers.js';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
import { createClient } from '@supabase/supabase-js';
import handler from '../api/absensi.js';

const JWT_SECRET = 'test-jwt';
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

  it('returns an HS256 authorized token for the configured login secret', async () => {
    configure();
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'POST', body: { action: 'login', secret: 'shared-secret' } }), res);
    expect(res.statusCode).toBe(200);
    expect(jwt.verify(res.body.token, JWT_SECRET, { algorithms: ['HS256'] })).toMatchObject({ authorized: true });
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
});
