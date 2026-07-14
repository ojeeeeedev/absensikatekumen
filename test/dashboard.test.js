import { describe, it, expect, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import handler from '../api/dashboard.js';
import { createMockRequest, createMockResponse } from './helpers.js';

const JWT_SECRET = 'test-jwt-secret-at-least-32-characters';

describe('/api/dashboard', () => {
  const originalEnv = process.env.DASHBOARD_URL;
  const originalJwtSecret = process.env.JWT_SECRET;

  afterEach(() => {
    process.env.DASHBOARD_URL = originalEnv;
    process.env.JWT_SECRET = originalJwtSecret;
  });

  it('should redirect to DASHBOARD_URL with a valid auth cookie', () => {
    process.env.DASHBOARD_URL = 'https://example.com/dashboard';
    process.env.JWT_SECRET = JWT_SECRET;
    const token = jwt.sign({ authorized: true }, JWT_SECRET, { algorithm: 'HS256' });
    const req = createMockRequest({ headers: { cookie: `auth_token=${token}` } });
    const res = createMockResponse();

    handler(req, res);

    expect(res.statusCode).toBe(307);
    expect(res.redirectUrl).toBe('https://example.com/dashboard');
  });

  it('should reject a spoofed auth cookie', () => {
    process.env.DASHBOARD_URL = 'https://example.com/dashboard';
    process.env.JWT_SECRET = JWT_SECRET;
    const req = createMockRequest({ headers: { cookie: 'auth_token=fake' } });
    const res = createMockResponse();

    handler(req, res);

    expect(res.statusCode).toBe(401);
  });

  it('should return 500 error if DASHBOARD_URL is not configured', () => {
    delete process.env.DASHBOARD_URL;
    process.env.JWT_SECRET = JWT_SECRET;
    const token = jwt.sign({ authorized: true }, JWT_SECRET, { algorithm: 'HS256' });
    const req = createMockRequest({ headers: { cookie: `auth_token=${token}` } });
    const res = createMockResponse();

    handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toContain('Dashboard URL not configured');
  });

  it('rejects unsupported methods before authentication', () => {
    const res = createMockResponse();
    handler(createMockRequest({ method: 'POST' }), res);
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('GET, HEAD');
  });
});
