import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockRequest, createMockResponse } from './helpers.js';

const { invalidateByTag } = vi.hoisted(() => ({ invalidateByTag: vi.fn() }));
vi.mock('@vercel/functions', () => ({ invalidateByTag }));

import handler from '../api/refresh-cache.js';

const originalCronSecret = process.env.CRON_SECRET;

describe('/api/refresh-cache', () => {
  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
    vi.clearAllMocks();
  });

  it('rejects requests without the configured cron secret', async () => {
    delete process.env.CRON_SECRET;
    const res = createMockResponse();

    await handler(createMockRequest(), res);

    expect(res.statusCode).toBe(401);
    expect(invalidateByTag).not.toHaveBeenCalled();
  });

  it('invalidates all student roster and photo entries', async () => {
    process.env.CRON_SECRET = 'cron-secret';
    invalidateByTag.mockResolvedValue(undefined);
    const res = createMockResponse();

    await handler(createMockRequest({ headers: { authorization: 'Bearer cron-secret' } }), res);

    expect(res.statusCode).toBe(200);
    expect(invalidateByTag).toHaveBeenCalledWith(['student-rosters', 'student-photos']);
  });
});
