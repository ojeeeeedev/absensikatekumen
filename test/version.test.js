import { describe, it, expect } from 'vitest';
import handler from '../api/version.js';
import { createMockRequest, createMockResponse } from './helpers.js';
import pkg from '../package.json';

describe('/api/version', () => {
  it('should handle OPTIONS request with 200 OK', async () => {
    const req = createMockRequest({ method: 'OPTIONS' });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(res.headers['Access-Control-Allow-Methods']).toBe('GET, OPTIONS');
  });

  it('should return the correct version from package.json', async () => {
    const req = createMockRequest({ method: 'GET' });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ version: pkg.version });
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
  });
});
