import { describe, expect, it, vi } from 'vitest';
import { listAllFiles } from '../api/_supabase-utils.js';

describe('Supabase storage utilities', () => {
  it('paginates until the storage listing is exhausted', async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ data: [{ name: 'a.jpg' }, { name: 'b.jpg' }], error: null })
      .mockResolvedValueOnce({ data: [{ name: 'c.jpg' }], error: null });
    const supabase = { storage: { from: vi.fn(() => ({ list })) } };

    const result = await listAllFiles(supabase, 'pasfoto-sab', 2);

    expect(result).toEqual({
      data: [{ name: 'a.jpg' }, { name: 'b.jpg' }, { name: 'c.jpg' }],
      error: null,
    });
    expect(list).toHaveBeenNthCalledWith(1, '', { limit: 2, offset: 0 });
    expect(list).toHaveBeenNthCalledWith(2, '', { limit: 2, offset: 2 });
  });
});
