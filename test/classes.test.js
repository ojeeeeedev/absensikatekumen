import { describe, it, expect, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import handler from '../api/classes.js';
import { createMockRequest, createMockResponse } from './helpers.js';

describe('/api/classes', () => {
  const validSecret = 'test-jwt-secret-at-least-32-characters';
  const originalSecret = process.env.JWT_SECRET;
  const originalScriptMap = process.env.VERCEL_SCRIPT_MAP_JSON;

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
    process.env.VERCEL_SCRIPT_MAP_JSON = originalScriptMap;
  });

  it('should handle OPTIONS request with 200 OK', async () => {
    const req = createMockRequest({ method: 'OPTIONS' });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
    expect(res.headers['Access-Control-Allow-Methods']).toBe('GET, OPTIONS');
    expect(res.headers['Access-Control-Allow-Headers']).toBe('Content-Type, Authorization');
  });

  it('should return 405 for non-GET and non-OPTIONS requests', async () => {
    const req = createMockRequest({ method: 'POST' });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({ status: 'error', message: 'Method POST not allowed' });
  });

  it('should return 401 if Authorization header is missing', async () => {
    const req = createMockRequest({ method: 'GET' });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ status: 'error', message: 'Unauthorized' });
  });

  it('should return 401 if Authorization token is invalid', async () => {
    process.env.JWT_SECRET = validSecret;
    const req = createMockRequest({
      method: 'GET',
      headers: {
        authorization: 'Bearer invalid-token'
      }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ status: 'error', message: 'Unauthorized' });
  });

  it('should return 200 with classes list for a valid token', async () => {
    const secret = validSecret;
    process.env.JWT_SECRET = secret;
    process.env.VERCEL_SCRIPT_MAP_JSON = JSON.stringify({
      SAB: 'https://script.google.com/macros/s/sab-url/exec',
      TOM: 'https://script.google.com/macros/s/tom-url/exec',
      YOUR_CLASS_CODE_HERE: 'https://placeholder.url'
    });

    const token = jwt.sign({ authorized: true }, secret, { algorithm: 'HS256' });

    const req = createMockRequest({
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    
    // Assert that 'YOUR_CLASS_CODE_HERE' is filtered out,
    // and SAB/TOM names are looked up from classcode.json
    expect(res.body.classes).toEqual([
      { code: 'SAB', name: 'Santo Sabinus' },
      { code: 'TOM', name: 'Santo Tomasz' }
    ]);
  });
});
