import { afterEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import middleware, { config } from '../middleware.js';

const JWT_SECRET = 'middleware-test-secret';
const originalJwtSecret = process.env.JWT_SECRET;

function request(path, token) {
  return new Request(`https://example.com${path}`, {
    headers: token ? { cookie: `auth_token=${token}` } : {},
  });
}

describe('routing middleware cache protection', () => {
  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
  });

  it('runs only for the protected routes', () => {
    expect(config).toEqual({
      matcher: ['/dashboard', '/api/students', '/api/photo'],
      runtime: 'nodejs',
    });
  });

  it('allows a valid login cookie before the CDN cache', () => {
    process.env.JWT_SECRET = JWT_SECRET;
    const token = jwt.sign({ authorized: true }, JWT_SECRET, { expiresIn: '1h' });

    expect(middleware(request('/api/students?classCode=SAB', token))).toBeUndefined();
    expect(middleware(request('/api/photo?studentId=2025%2FSAB%2F001', token))).toBeUndefined();
  });

  it('rejects missing and expired login cookies', async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    const expiredToken = jwt.sign({ authorized: true }, JWT_SECRET, { expiresIn: -1 });

    const missing = middleware(request('/api/students?classCode=SAB'));
    const expired = middleware(request('/api/photo?studentId=2025%2FSAB%2F001', expiredToken));

    expect(missing.status).toBe(401);
    expect(expired.status).toBe(401);
    await expect(missing.json()).resolves.toEqual({ status: 'error', message: 'Unauthorized' });
  });
});
