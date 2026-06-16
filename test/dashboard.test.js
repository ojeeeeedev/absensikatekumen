import { describe, it, expect, afterEach } from 'vitest';
import handler from '../api/dashboard.js';
import { createMockRequest, createMockResponse } from './helpers.js';

describe('/api/dashboard', () => {
  const originalEnv = process.env.DASHBOARD_URL;

  afterEach(() => {
    process.env.DASHBOARD_URL = originalEnv;
  });

  it('should redirect to DASHBOARD_URL if configured', () => {
    process.env.DASHBOARD_URL = 'https://example.com/dashboard';
    const req = createMockRequest();
    const res = createMockResponse();

    handler(req, res);

    expect(res.statusCode).toBe(307);
    expect(res.redirectUrl).toBe('https://example.com/dashboard');
  });

  it('should return 500 error if DASHBOARD_URL is not configured', () => {
    delete process.env.DASHBOARD_URL;
    const req = createMockRequest();
    const res = createMockResponse();

    handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toContain('Dashboard URL not configured');
  });
});
