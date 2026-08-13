import { createClient } from '@supabase/supabase-js';
import { verifyJwt } from './_auth.js';
import {
  PHOTO_MIME_TYPES,
  bucketNameForClass,
  classCodeFromStudentId,
  findStudentPhoto,
  storageBaseNameForStudent,
} from './_supabase-utils.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ status: 'error', message: `Method ${req.method} not allowed` });
  }

  try {
    verifyJwt(req, { allowCookie: true });
  } catch (err) {
    return res.status(err.statusCode || 401).json({ status: 'error', message: 'Unauthorized' });
  }

  const studentId = String(req.query?.studentId || '').trim();
  const classCode = classCodeFromStudentId(studentId);
  if (!classCode) {
    return res.status(400).json({ status: 'error', message: 'studentId tidak valid' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ status: 'error', message: 'Supabase tidak terkonfigurasi' });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const bucketName = bucketNameForClass(classCode);
    const requestedFilename = String(req.query?.filename || '').trim();
    let photo;

    if (requestedFilename) {
      const parts = requestedFilename.split('.');
      const ext = parts.pop()?.toLowerCase();
      const expectedBase = storageBaseNameForStudent(studentId);
      if (!PHOTO_MIME_TYPES[ext] || parts.join('.').toLowerCase() !== expectedBase.toLowerCase()) {
        return res.status(400).json({ status: 'error', message: 'filename tidak valid' });
      }
      photo = { name: requestedFilename };
    } else {
      photo = await findStudentPhoto(supabase, bucketName, studentId);
    }

    if (!photo) {
      return res.status(404).json({ status: 'error', message: 'Foto tidak ditemukan' });
    }

    let ext = photo.name.split('.').pop().toLowerCase();
    let { data, error } = await supabase.storage.from(bucketName).download(photo.name);
    if ((error || !data) && requestedFilename) {
      photo = await findStudentPhoto(supabase, bucketName, studentId);
      if (photo) {
        ext = photo.name.split('.').pop().toLowerCase();
        ({ data, error } = await supabase.storage.from(bucketName).download(photo.name));
      }
    }
    if (error || !data) {
      return res.status(404).json({ status: 'error', message: 'Foto tidak ditemukan' });
    }

    res.setHeader('Content-Type', PHOTO_MIME_TYPES[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'HEAD') return res.status(200).end();

    const buffer = Buffer.from(await data.arrayBuffer());
    return res.status(200).send(buffer);
  } catch (err) {
    console.error('[photo] Error:', err);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil foto' });
  }
}
