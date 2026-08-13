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
      expect(log).toHaveBeenCalledWith(
        '[local-dev]',
        'GET',
        '/api/version',
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

      const staticResponse = await fetch(`${baseUrl}/theme.js`);
      expect(staticResponse.status).toBe(200);
      expect(staticResponse.headers.get('ratelimit-limit')).toBeNull();

      const photoResponse = await fetch(`${baseUrl}/api/photo?studentId=2025%2FSAB%2F001`);
      expect(photoResponse.status).toBe(401);
      expect(photoResponse.headers.get('ratelimit-limit')).toBeNull();

      const photoHeadResponse = await fetch(`${baseUrl}/api/photo?studentId=2025%2FSAB%2F001`, { method: 'HEAD' });
      expect(photoHeadResponse.status).toBe(401);
      expect(photoHeadResponse.headers.get('ratelimit-limit')).toBeNull();

      expect((await fetch(`${baseUrl}/api/version`)).status).toBe(429);
    } finally {
      log.mockRestore();
    }
  });
});
