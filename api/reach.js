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

// Tapping "WhatsApp" opens this route in a new tab, so failures must render a
// readable page there instead of raw JSON. API clients still receive JSON.
function wantsHtml(req) {
  return String(req.headers?.accept || '').includes('text/html');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function errorPage(statusCode, apiMessage) {
  const signedOut = statusCode === 401;
  const message = signedOut ? 'Sesi Anda sudah berakhir.' : apiMessage;
  const actionHref = signedOut ? '/' : '/profile';
  const actionLabel = signedOut ? 'Masuk kembali' : 'Kembali ke Profil';
  const hint = signedOut
    ? 'Silakan masuk kembali, lalu coba lagi.'
    : 'Periksa data kontak katekumen di spreadsheet, lalu coba lagi.';
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>WhatsApp tidak dapat dibuka</title>
<link rel="stylesheet" href="/style.css">
<script>try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
<style>
  body.reach-error{min-height:100dvh;display:grid;place-items:center;margin:0;padding:var(--space-4,16px);background:var(--background);color:var(--foreground);font-family:var(--font-sans,Inter,system-ui,sans-serif)}
  .reach-error-card{width:100%;max-width:420px;padding:var(--space-6,24px);border:1px solid var(--border);border-radius:var(--radius-lg,16px);background:var(--card);box-shadow:var(--shadow-md)}
  .reach-error-card h1{margin:0 0 var(--space-2,8px);font-size:1.125rem;font-weight:600}
  .reach-error-card p{margin:0 0 var(--space-2,8px);font-size:0.9375rem;line-height:1.5}
  .reach-error-card .reach-error-hint{color:var(--muted-foreground)}
  .reach-error-card a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;margin-top:var(--space-4,16px);padding:0 var(--space-4,16px);border-radius:var(--radius-full,999px);background:var(--primary);color:var(--primary-foreground);font-weight:600;text-decoration:none}
  .reach-error-card a:focus-visible{outline:2px solid var(--ring);outline-offset:2px}
</style>
</head>
<body class="reach-error">
<main class="reach-error-card" role="alert">
<h1>WhatsApp tidak dapat dibuka</h1>
<p>${escapeHtml(message)}</p>
<p class="reach-error-hint">${escapeHtml(hint)}</p>
<a href="${actionHref}">${actionLabel}</a>
</main>
</body>
</html>`;
}

function fail(req, res, statusCode, message) {
  if (wantsHtml(req)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(statusCode).send(errorPage(statusCode, message));
  }
  return res.status(statusCode).json({ status: 'error', message });
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
    return fail(req, res, err.statusCode || 401, 'Unauthorized');
  }

  const studentId = String(req.query?.studentId || '').trim();
  const classCode = classCodeFromStudentId(studentId);
  if (!classCode) {
    return fail(req, res, 400, 'studentId tidak valid');
  }

  let scriptMap;
  try {
    scriptMap = getScriptMap();
  } catch {
    return fail(req, res, 500, 'Server configuration error');
  }

  const scriptURL = scriptMap[classCode];
  if (!scriptURL) {
    return fail(req, res, 400, 'Kelas tidak valid');
  }

  const gasSecret = process.env.GAS_SECRET_KEY;
  if (!gasSecret) {
    return fail(req, res, 500, 'Server GAS authentication is not configured');
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
      return fail(req, res, statusCode, statusCode === 404 ? 'Nomor WhatsApp tidak ditemukan' : 'Gagal mengambil nomor WhatsApp');
    }

    const phone = normalizeIndonesianPhone(data.phone);
    if (!phone) {
      return fail(req, res, 422, 'Format nomor WhatsApp tidak valid');
    }

    return res.redirect(302, `https://wa.me/${phone}`);
  } catch {
    return fail(req, res, 502, 'Gagal mengambil nomor WhatsApp');
  }
}
