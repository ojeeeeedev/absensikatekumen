import { afterEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { createMockRequest, createMockResponse } from './helpers.js';
import handler from '../api/reach.js';

const JWT_SECRET = 'test-jwt';
const GAS_URL = 'https://gas.example/reach';
const originalEnv = { ...process.env };
const originalFetch = global.fetch;
const token = () => jwt.sign({ authorized: true }, JWT_SECRET, { algorithm: 'HS256' });

function configure() {
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.VERCEL_SCRIPT_MAP_JSON = JSON.stringify({ SAB: GAS_URL });
  process.env.GAS_SECRET_KEY = 'gas-secret';
}

function request(options = {}) {
  return createMockRequest({
    method: 'GET',
    headers: { cookie: `auth_token=${token()}` },
    query: { studentId: '1/SAB/2' },
    ...options,
  });
}

function gasResult(data) {
  global.fetch = vi.fn().mockResolvedValue({
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  });
}

describe('/api/reach', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    if (originalFetch) global.fetch = originalFetch; else delete global.fetch;
    vi.restoreAllMocks();
  });

  it('requires authentication and allows only GET', async () => {
    configure();
    const unauthorized = createMockResponse();
    await handler(request({ headers: {} }), unauthorized);
    expect(unauthorized.statusCode).toBe(401);

    const unsupported = createMockResponse();
    await handler(request({ method: 'POST' }), unsupported);
    expect(unsupported.statusCode).toBe(405);
    expect(unsupported.headers.Allow).toBe('GET');
  });

  it('rejects invalid and unmapped student IDs before contacting GAS', async () => {
    configure();
    global.fetch = vi.fn();

    const invalid = createMockResponse();
    await handler(request({ query: { studentId: '../SAB/2' } }), invalid);
    expect(invalid.statusCode).toBe(400);

    const unmapped = createMockResponse();
    await handler(request({ query: { studentId: '1/TOM/2' } }), unmapped);
    expect(unmapped.statusCode).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['0812 3456-7890', '6281234567890'],
    ['+62 812-3456-7890', '6281234567890'],
    ['81234567890', '6281234567890'],
  ])('redirects a valid Indonesian number without returning it as JSON', async (phone, expected) => {
    configure();
    gasResult({ status: 'ok', phone });
    const res = createMockResponse();

    await handler(request(), res);

    expect(res.statusCode).toBe(302);
    expect(res.redirectUrl).toBe(`https://wa.me/${expected}`);
    expect(res.body).toBeNull();
    expect(res.headers['Cache-Control']).toBe('private, no-store');
    expect(res.headers['Referrer-Policy']).toBe('no-referrer');
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({
      action: 'getStudentContact',
      studentId: '1/SAB/2',
      api_secret: 'gas-secret',
    });
  });

  it.each([
    [{ status: 'not_found' }, 404],
    [{ status: 'missing_contact' }, 404],
    [{ status: 'ok', phone: 'not-a-phone' }, 422],
  ])('fails safely for unavailable or invalid contact data', async (data, statusCode) => {
    configure();
    gasResult(data);
    const res = createMockResponse();

    await handler(request(), res);

    expect(res.statusCode).toBe(statusCode);
    expect(JSON.stringify(res.body)).not.toContain(data.phone || '0812');
    expect(res.redirectUrl).toBeNull();
  });
});
