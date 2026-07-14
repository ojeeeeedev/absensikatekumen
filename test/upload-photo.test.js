import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { createMockResponse } from './helpers.js';

const storage = {
  createBucket: vi.fn().mockResolvedValue({ error: null }),
  from: vi.fn(() => ({
    list: vi.fn().mockResolvedValue({ data: [], error: null }),
    remove: vi.fn().mockResolvedValue({ error: null }),
    upload: vi.fn().mockResolvedValue({ error: null }),
  })),
};
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ storage })) }));

import handler, { matchesMimeSignature, parseMultipart } from '../api/upload-photo.js';

const JWT_SECRET = 'test-jwt-secret-at-least-32-characters';
const BOUNDARY = 'test-boundary';

function multipartBody({ studentId, file, mimeType = 'image/jpeg' } = {}) {
  const chunks = [];
  if (studentId !== undefined) {
    chunks.push(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="studentId"\r\n\r\n${studentId}\r\n`);
  }
  if (file !== undefined) {
    chunks.push(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="photo"; filename="photo.jpg"\r\nContent-Type: ${mimeType}\r\n\r\n`);
    chunks.push(file);
    chunks.push('\r\n');
  }
  chunks.push(`--${BOUNDARY}--\r\n`);
  return Buffer.concat(chunks.map((chunk) => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
}

function streamRequest(body, contentType = `multipart/form-data; boundary=${BOUNDARY}`) {
  const req = new EventEmitter();
  req.method = 'POST';
  req.headers = {
    authorization: `Bearer ${jwt.sign({ authorized: true }, JWT_SECRET)}`,
    'content-type': contentType,
  };
  queueMicrotask(() => {
    req.emit('data', body);
    req.emit('end');
  });
  return req;
}

describe('/api/upload-photo multipart validation', () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalSupabaseKey = process.env.SUPABASE_KEY;

  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.SUPABASE_URL = originalSupabaseUrl;
    process.env.SUPABASE_KEY = originalSupabaseKey;
    vi.clearAllMocks();
  });

  function configureEnvironment() {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_KEY = 'service-key';
  }

  it('parses a valid student field and file without altering file bytes', () => {
    const parsed = parseMultipart(multipartBody({
      studentId: '2025/SAB/001',
      file: Buffer.from([0, 1, 2, 255]),
    }), BOUNDARY);

    expect(parsed.fields.studentId).toBe('2025/SAB/001');
    expect(parsed.fileBuffer).toEqual(Buffer.from([0, 1, 2, 255]));
    expect(parsed.mimeType).toBe('image/jpeg');
  });

  it('rejects a missing multipart boundary', async () => {
    configureEnvironment();
    const req = streamRequest(Buffer.alloc(0), 'multipart/form-data');
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/multipart\/form-data/);
  });

  it('rejects an unauthenticated upload before storage access', async () => {
    configureEnvironment();
    const req = streamRequest(Buffer.alloc(0));
    delete req.headers.authorization;
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(storage.createBucket).not.toHaveBeenCalled();
  });

  it('supports quoted boundaries and rejects a missing file', async () => {
    configureEnvironment();
    const req = streamRequest(
      multipartBody({ studentId: '2025/SAB/001' }),
      `multipart/form-data; boundary="${BOUNDARY}"`,
    );
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/File foto/);
  });

  it('rejects a missing student ID', async () => {
    configureEnvironment();
    const req = streamRequest(multipartBody({ file: Buffer.from('photo') }));
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/studentId/);
  });

  it('rejects unsupported MIME types', async () => {
    configureEnvironment();
    const req = streamRequest(multipartBody({
      studentId: '2025/SAB/001',
      file: Buffer.from('photo'),
      mimeType: 'image/gif',
    }));
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/JPG, PNG, atau WebP/);
  });

  it('rejects bytes that do not match the declared image type', async () => {
    configureEnvironment();
    const req = streamRequest(multipartBody({
      studentId: '2025/SAB/001',
      file: Buffer.from('not-a-jpeg'),
      mimeType: 'image/jpeg',
    }));
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/format gambar/);
    expect(matchesMimeSignature(Buffer.from('not-a-jpeg'), 'image/jpeg')).toBe(false);
  });

  it('stops reading requests that exceed the upload limit', async () => {
    configureEnvironment();
    const req = streamRequest(Buffer.alloc((5 * 1024 * 1024) + 10241));
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(413);
  });

  it('uploads a valid photo and returns a same-origin URL', async () => {
    configureEnvironment();
    const req = streamRequest(multipartBody({ studentId: '2025/SAB/001', file: Buffer.from([0xff, 0xd8, 0xff]) }));
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.image).toMatch(/^\/api\/photo\?studentId=/);
    expect(storage.createBucket).toHaveBeenCalledWith('pasfoto-sab', expect.any(Object));
  });
});
