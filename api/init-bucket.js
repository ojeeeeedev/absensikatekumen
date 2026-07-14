import { createClient } from '@supabase/supabase-js';
import { ensureBucketExists, bucketNameForClass } from './_supabase-utils.js';
import { verifyJwt } from './_auth.js';
import { getScriptMap } from './_gas-utils.js';

/**
 * POST /api/init-bucket
 *
 * Proactively creates the Supabase storage bucket for a given class code so
 * that facilitators can provision storage before any student QR code is scanned
 * or any photo is uploaded.
 *
 * The bucket name follows the convention: "pasfoto-{classCode.toLowerCase()}"
 * e.g. classCode "SAB" → bucket "pasfoto-sab"
 *
 * The operation is idempotent — calling it when the bucket already exists is
 * safe and returns { status: "ok", created: false }.
 *
 * Request body (JSON):
 *   { "classCode": "SAB" }
 *
 * Responses:
 *   201 { status: "ok", created: true,  bucketName, message }  — newly created
 *   200 { status: "ok", created: false, bucketName, message }  — already existed
 *   400 { status: "error", message }                           — validation error
 *   401 { status: "error", message }                           — auth error
 *   500 { status: "error", message }                           — server error
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: `Method ${req.method} not allowed` });
  }

  // --- JWT Authentication ---
  try {
    verifyJwt(req, { allowCookie: true });
  } catch (err) {
    return res.status(401).json({ status: 'error', message: 'Akses ditolak: Token tidak valid' });
  }

  // --- Validate request body ---
  const { classCode } = req.body || {};
  if (!classCode || typeof classCode !== 'string' || classCode.trim() === '') {
    return res.status(400).json({ status: 'error', message: 'classCode diperlukan' });
  }

  // Class codes must be 2–5 uppercase alphanumeric characters
  const normalizedCode = classCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,5}$/.test(normalizedCode)) {
    return res.status(400).json({
      status: 'error',
      message: 'Format classCode tidak valid. Gunakan 2–5 karakter huruf/angka (contoh: SAB, TOM)',
    });
  }

  let scriptMap;
  try {
    scriptMap = getScriptMap();
  } catch {
    return res.status(500).json({ status: 'error', message: 'Server configuration error' });
  }
  if (!scriptMap[normalizedCode]) {
    return res.status(403).json({ status: 'error', message: 'Class is not configured' });
  }

  // --- Supabase Client ---
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ status: 'error', message: 'Supabase tidak terkonfigurasi' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const bucketName = bucketNameForClass(normalizedCode);

  try {
    const { created } = await ensureBucketExists(supabase, bucketName);

    const httpStatus = created ? 201 : 200;
    const message = created
      ? `Bucket "${bucketName}" berhasil dibuat`
      : `Bucket "${bucketName}" sudah ada`;

    return res.status(httpStatus).json({
      status: 'ok',
      created,
      bucketName,
      message,
    });
  } catch (err) {
    console.error('[init-bucket] Error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
