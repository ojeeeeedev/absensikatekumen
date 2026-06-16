import { describe, it, expect, afterEach } from 'vitest';
import handler from '../api/register.js';
import { createMockRequest, createMockResponse } from './helpers.js';

describe('/api/register', () => {
  const originalEnv = process.env.DAFTAR_URL;

  afterEach(() => {
    process.env.DAFTAR_URL = originalEnv;
  });

  it('should redirect to DAFTAR_URL if configured', () => {
    process.env.DAFTAR_URL = 'https://example.com/register';
    const req = createMockRequest();
    const res = createMockResponse();

    handler(req, res);

    expect(res.statusCode).toBe(307);
    expect(res.redirectUrl).toBe('https://example.com/register');
  });

  it('should return 500 error if DAFTAR_URL is not configured', () => {
    delete process.env.DAFTAR_URL;
    const req = createMockRequest();
    const res = createMockResponse();

    handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toContain('Daftar URL not configured');
  });
});
