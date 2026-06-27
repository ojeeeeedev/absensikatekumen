import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/**
 * Parses a multipart/form-data body from the raw buffer.
 * Returns { fields: { studentId }, fileBuffer, mimeType, originalFilename }
 */
function parseMultipart(buffer, boundary) {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = 0;

  while (start < buffer.length) {
    const boundaryIdx = buffer.indexOf(boundaryBuffer, start);
    if (boundaryIdx === -1) break;

    const headerStart = boundaryIdx + boundaryBuffer.length + 2; // skip \r\n
    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), headerStart);
    if (headerEnd === -1) break;

    const headerStr = buffer.slice(headerStart, headerEnd).toString('utf8');
    const bodyStart = headerEnd + 4; // skip \r\n\r\n

    const nextBoundary = buffer.indexOf(boundaryBuffer, bodyStart);
    const bodyEnd = nextBoundary === -1 ? buffer.length : nextBoundary - 2; // trim \r\n before boundary

    parts.push({ headers: headerStr, body: buffer.slice(bodyStart, bodyEnd) });
    start = nextBoundary === -1 ? buffer.length : nextBoundary;
  }

  const result = { fields: {}, fileBuffer: null, mimeType: null, originalFilename: null };

  for (const part of parts) {
    const dispMatch = part.headers.match(/Content-Disposition: form-data; name="([^"]+)"(?:; filename="([^"]*)")?/i);
    const typeMatch = part.headers.match(/Content-Type: ([^\r\n]+)/i);

    if (!dispMatch) continue;
    const fieldName = dispMatch[1];
    const filename = dispMatch[2] || null;

    if (filename !== null) {
      // This is the file field
      result.fileBuffer = part.body;
      result.mimeType = typeMatch ? typeMatch[1].trim() : 'application/octet-stream';
      result.originalFilename = filename;
    } else {
      result.fields[fieldName] = part.body.toString('utf8');
    }
  }

  return result;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: `Method ${req.method} not allowed` });
  }

  // --- JWT Authentication ---
  const JWT_SECRET = process.env.JWT_SECRET;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Akses ditolak: Token tidak valid' });
  }
  try {
    jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    return res.status(401).json({ status: 'error', message: 'Akses ditolak: Token tidak valid' });
  }

  // --- Supabase Client ---
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ status: 'error', message: 'Supabase tidak terkonfigurasi' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // --- Parse multipart body ---
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
  if (!boundaryMatch) {
    return res.status(400).json({ status: 'error', message: 'Content-Type harus multipart/form-data' });
  }
  const boundary = boundaryMatch[1];

  // Collect raw body buffer
  let rawBody;
  try {
    rawBody = await new Promise((resolve, reject) => {
      const chunks = [];
      let totalSize = 0;
      req.on('data', (chunk) => {
        totalSize += chunk.length;
        if (totalSize > MAX_FILE_SIZE + 10240) { // 5MB + 10KB header overhead
          reject(new Error('FILE_TOO_LARGE'));
        }
        chunks.push(chunk);
      });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  } catch (err) {
    if (err.message === 'FILE_TOO_LARGE') {
      return res.status(413).json({ status: 'error', message: 'Ukuran file maksimal 5MB' });
    }
    return res.status(500).json({ status: 'error', message: 'Gagal membaca file' });
  }

  const { fields, fileBuffer, mimeType } = parseMultipart(rawBody, boundary);

  // --- Validate inputs ---
  const studentId = fields.studentId?.trim();
  if (!studentId) {
    return res.status(400).json({ status: 'error', message: 'studentId diperlukan' });
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    return res.status(400).json({ status: 'error', message: 'File foto tidak ditemukan' });
  }

  if (fileBuffer.length > MAX_FILE_SIZE) {
    return res.status(413).json({ status: 'error', message: 'Ukuran file maksimal 5MB' });
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return res.status(400).json({ status: 'error', message: 'Format file harus JPG, PNG, atau WebP' });
  }

  // Validate studentId format: NAME/CLASSCODE/NUMBER
  const parts = studentId.split('/');
  if (parts.length < 2) {
    return res.status(400).json({ status: 'error', message: 'Format studentId tidak valid' });
  }

  const classCode = parts[1]?.toUpperCase();
  if (!classCode) {
    return res.status(400).json({ status: 'error', message: 'Class code tidak valid' });
  }

  // --- Derive storage path ---
  const bucketName = `pasfoto-${classCode.toLowerCase()}`;
  const ext = ALLOWED_EXTENSIONS[mimeType];
  const baseFilename = studentId.replace(/\//g, '-');
  const targetFilename = `${baseFilename}.${ext}`;

  try {
    // Delete any existing photos for this student (all extensions)
    const { data: existingFiles } = await supabase.storage
      .from(bucketName)
      .list('', { search: baseFilename });

    if (existingFiles && existingFiles.length > 0) {
      const toDelete = existingFiles
        .filter(f => {
          const nameParts = f.name.split('.');
          nameParts.pop();
          return nameParts.join('.') === baseFilename;
        })
        .map(f => f.name);

      if (toDelete.length > 0) {
        await supabase.storage.from(bucketName).remove(toDelete);
      }
    }

    // Upload the new photo
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(targetFilename, fileBuffer, {
        contentType: mimeType,
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('[upload-photo] Supabase upload error:', uploadError);
      return res.status(500).json({ status: 'error', message: `Gagal mengunggah foto: ${uploadError.message}` });
    }

    // Generate a fresh signed URL to return so the UI can update immediately
    const { data: sigData, error: sigError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(targetFilename, 60);

    const signedUrl = sigError ? null : sigData?.signedUrl;

    return res.status(200).json({
      status: 'ok',
      message: 'Foto berhasil diunggah',
      filename: targetFilename,
      signedUrl,
    });
  } catch (err) {
    console.error('[upload-photo] Unexpected error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
