import { verifyJwt } from './_auth.js';
import { getScriptMap, readJsonResponse } from './_gas-utils.js';
import { classCodeFromStudentId } from './_supabase-utils.js';

function normalizeIndonesianPhone(value) {
  const compact = String(value || '').trim().replace(/[\s().-]/g, '');
  if (!/^\+?\d+$/.test(compact)) return null;

  let digits = compact.replace(/^\+/, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  if (digits.startsWith('8')) digits = `62${digits}`;

  return /^628\d{8,11}$/.test(digits) ? digits : null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
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

  let scriptMap;
  try {
    scriptMap = getScriptMap();
  } catch {
    return res.status(500).json({ status: 'error', message: 'Server configuration error' });
  }

  const scriptURL = scriptMap[classCode];
  if (!scriptURL) {
    return res.status(400).json({ status: 'error', message: 'Kelas tidak valid' });
  }

  const gasSecret = process.env.GAS_SECRET_KEY;
  if (!gasSecret) {
    return res.status(500).json({ status: 'error', message: 'Server GAS authentication is not configured' });
  }

  try {
    const gasResponse = await fetch(scriptURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getStudentContact',
        studentId,
        api_secret: gasSecret,
      }),
    });
    const { data, valid } = await readJsonResponse(gasResponse);
    if (!valid || data?.status !== 'ok') {
      const statusCode = ['not_found', 'missing_contact'].includes(data?.status) ? 404 : 502;
      return res.status(statusCode).json({
        status: 'error',
        message: statusCode === 404 ? 'Nomor WhatsApp tidak ditemukan' : 'Gagal mengambil nomor WhatsApp',
      });
    }

    const phone = normalizeIndonesianPhone(data.phone);
    if (!phone) {
      return res.status(422).json({ status: 'error', message: 'Format nomor WhatsApp tidak valid' });
    }

    return res.redirect(302, `https://wa.me/${phone}`);
  } catch {
    return res.status(502).json({ status: 'error', message: 'Gagal mengambil nomor WhatsApp' });
  }
}
