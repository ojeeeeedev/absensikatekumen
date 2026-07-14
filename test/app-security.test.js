import { once } from 'node:events';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import app from '../app.js';

describe('local server security middleware', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    server.close();
    await once(server, 'close');
  });

  it('keeps request data out of logs, exposes uploads, and limits bursts', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const uploadResponse = await fetch(`${baseUrl}/api/upload-photo`, { method: 'POST' });
      expect(uploadResponse.status).toBe(401);
      expect(log).toHaveBeenCalledWith('[local-dev]', 'POST', '/api/upload-photo');

      const firstResponse = await fetch(`${baseUrl}/api/version?probe=%25s`);
      expect(firstResponse.status).toBe(200);
      expect(firstResponse.headers.get('content-security-policy')).toContain("script-src 'self' https://unpkg.com");
      expect(firstResponse.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
      expect(firstResponse.headers.get('strict-transport-security')).toContain('max-age=31536000');
      expect(firstResponse.headers.get('x-content-type-options')).toBe('nosniff');
      expect(firstResponse.headers.get('x-frame-options')).toBe('DENY');
      expect(firstResponse.headers.get('x-powered-by')).toBeNull();
      expect(log).toHaveBeenCalledWith(
        '[local-dev]',
        'GET',
        '/api/version?probe=%25s',
      );

      const allowedResponses = await Promise.all(
        Array.from({ length: 98 }, () => fetch(`${baseUrl}/api/version`)),
      );
      expect(allowedResponses.every(response => response.status === 200)).toBe(true);

      const limitedResponse = await fetch(`${baseUrl}/api/version`);
      expect(limitedResponse.status).toBe(429);
      expect(limitedResponse.headers.get('ratelimit-limit')).toBe('100');
      expect(limitedResponse.headers.get('retry-after')).toBe('60');
      await expect(limitedResponse.json()).resolves.toMatchObject({ status: 'error' });
    } finally {
      log.mockRestore();
    }
  });
});
