import { describe, it, expect } from 'vitest';
import handler from '../api/dashboard.js';
import { createMockRequest, createMockResponse } from './helpers.js';

describe('/api/dashboard', () => {
  it('should permanently redirect to the native dashboard route', () => {
    const req = createMockRequest();
    const res = createMockResponse();

    handler(req, res);

    expect(res.statusCode).toBe(308);
    expect(res.redirectUrl).toBe('/dashboard');
    expect(res.headers['Cache-Control']).toBe('no-store');
  });
});
