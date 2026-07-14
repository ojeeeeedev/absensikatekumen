import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { createMockResponse } from './helpers.js';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ storage: {} })),
}));

import handler, { parseMultipart } from '../api/upload-photo.js';

const JWT_SECRET = 'test-secret';
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

  it('stops reading requests that exceed the upload limit', async () => {
    configureEnvironment();
    const req = streamRequest(Buffer.alloc((5 * 1024 * 1024) + 10241));
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(413);
  });
});
