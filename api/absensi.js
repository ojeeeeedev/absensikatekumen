import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { clearSessionCookie, setSessionCookie, verifyJwt } from './_auth.js';
import { getScriptMap, readJsonResponse } from './_gas-utils.js';
import { bucketNameForClass, classCodeFromStudentId, findStudentPhoto, photoUrlForStudent, photoVersion } from './_supabase-utils.js';

// Attendance outcomes returned by Apps Script (see apps-script/Code.js doPost):
//   ok | duplicate | not found | busy | error
// "busy" (lock contention) is mapped to HTTP 503 so the client queue retries it.
const STUDENT_ID_MAX_LENGTH = 64;
const WEEK_PATTERN = /^R?\d{1,2}$/i;
const GAS_TIMEOUT_MS = 25000;
const PHOTO_LOOKUP_TIMEOUT_MS = 4000;
const LOGIN_FAILURE_DELAY_MS = 750;
const SESSION_TTL_SECONDS = 3600;
// Message sent by Apps Script deployments that predate the explicit "busy" status.
const LEGACY_BUSY_MESSAGE = 'Sistem sedang sibuk';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Per-IP login throttle. It lives in the function instance's memory, so on
// Vercel it is best-effort (warm instances are reused, but not shared). For a
// global limit add a Vercel Firewall rate-limit rule on POST /api/absensi.
const LOGIN_MAX_FAILURES = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_TRACKED_IPS_MAX = 5000;
const loginFailures = new Map();

function clientIp(req) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return String(req.headers?.['x-real-ip'] || '').trim() || forwarded || req.socket?.remoteAddress || 'unknown';
}

function loginBlockedFor(ip, now = Date.now()) {
  const entry = loginFailures.get(ip);
  if (!entry || entry.resetAt <= now) return 0;
  return entry.count >= LOGIN_MAX_FAILURES ? Math.ceil((entry.resetAt - now) / 1000) : 0;
}

function recordLoginFailure(ip, now = Date.now()) {
  if (loginFailures.size >= LOGIN_TRACKED_IPS_MAX) {
    for (const [key, entry] of loginFailures) if (entry.resetAt <= now) loginFailures.delete(key);
    if (loginFailures.size >= LOGIN_TRACKED_IPS_MAX) loginFailures.delete(loginFailures.keys().next().value);
  }
  const entry = loginFailures.get(ip);
  if (!entry || entry.resetAt <= now) loginFailures.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  else entry.count += 1;
}

export function resetLoginThrottleForTests() {
  loginFailures.clear();
}

function withTimeout(promise, ms, fallback) {
  let timer;
  return Promise.race([
    promise,
    new Promise(resolve => { timer = setTimeout(() => resolve(fallback), ms); }),
  ]).finally(() => clearTimeout(timer));
}

function isBusyResponse(data) {
  return data.status === 'busy'
    || (data.status === 'error' && String(data.message || '').startsWith(LEGACY_BUSY_MESSAGE));
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: `Method ${req.method} not allowed` });
  }

  const SHARED_SECRET = process.env.AUTH_SECRET;
  const JWT_SECRET = process.env.JWT_SECRET;
  const body = req.body && typeof req.body === 'object' ? req.body : {};

  try {
    // --- Login ---
    if (body.action === 'login') {
      if (!SHARED_SECRET || !JWT_SECRET) {
        return res.status(500).json({ status: 'error', message: 'Server authentication is not configured' });
      }
      const ip = clientIp(req);
      const retryAfter = loginBlockedFor(ip);
      if (retryAfter) {
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(429).json({ status: 'error', message: 'Terlalu banyak percobaan. Coba lagi nanti.' });
      }
      const providedSecret = Buffer.from(String(body.secret || ''));
      const storedSecret = Buffer.from(String(SHARED_SECRET || ''));

      if (providedSecret.length === storedSecret.length &&
          crypto.timingSafeEqual(providedSecret, storedSecret)) {
        const token = jwt.sign({ authorized: true }, JWT_SECRET, { expiresIn: SESSION_TTL_SECONDS });
        const { exp } = jwt.decode(token);
        // The JWT is only ever sent as an HttpOnly cookie; the page receives
        // just the (non-secret) expiry to drive its session state.
        setSessionCookie(req, res, token, SESSION_TTL_SECONDS);
        loginFailures.delete(ip);
        return res.status(200).json({ status: 'ok', expiresAt: exp });
      }
      // Slow down online guessing of the shared secret.
      recordLoginFailure(ip);
      await delay(LOGIN_FAILURE_DELAY_MS);
      return res.status(401).json({ status: 'error', message: 'Password salah' });
    }

    // --- Logout ---
    if (body.action === 'logout') {
      clearSessionCookie(req, res);
      // Drops privately cached student photos from this device.
      res.setHeader('Clear-Site-Data', '"cache"');
      return res.status(200).json({ status: 'ok' });
    }

    // --- Attendance ---
    try {
      verifyJwt(req, { allowCookie: true });
    } catch {
      return res.status(401).json({ status: 'error', message: 'Akses ditolak: Token tidak valid' });
    }

    const { studentId, week } = body;
    const classCode = typeof studentId === 'string' && studentId.length <= STUDENT_ID_MAX_LENGTH
      ? classCodeFromStudentId(studentId)
      : null;
    if (!classCode) {
      return res.status(400).json({ status: "error", message: "QR tidak valid" });
    }
    const weekValue = (typeof week === 'string' || typeof week === 'number') ? String(week).trim() : '';
    if (!WEEK_PATTERN.test(weekValue)) {
      return res.status(400).json({ status: "error", message: "Topik tidak valid" });
    }

    let SCRIPT_MAP;
    try {
      SCRIPT_MAP = getScriptMap();
    } catch (e) {
      console.error("Error parsing VERCEL_SCRIPT_MAP_JSON:", e);
      return res.status(500).json({ status: "error", message: "Server parsing configuration error." });
    }

    const scriptURL = SCRIPT_MAP[classCode];
    if (!scriptURL) {
      console.error(`No GAS deployment mapped for class ${classCode}`);
      return res.status(400).json({ status: "error", message: "Kelas tidak dikenali" });
    }

    const GAS_SECRET_KEY = process.env.GAS_SECRET_KEY;
    if (!GAS_SECRET_KEY) {
      return res.status(500).json({ status: "error", message: "Server GAS authentication is not configured" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;
    const supabase = (SUPABASE_URL && SUPABASE_KEY)
      ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
    const trimmedId = studentId.trim();

    // Only the attendance fields are forwarded. Forwarding the raw body would
    // let a client invoke other GAS actions (e.g. getStudentContact).
    const gasPromise = fetch(scriptURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: trimmedId, week: weekValue, api_secret: GAS_SECRET_KEY }),
      signal: AbortSignal.timeout(GAS_TIMEOUT_MS),
    });

    // The photo is optional: a slow or failing lookup must not delay attendance.
    const imagePromise = withTimeout((async () => {
      if (!supabase) return null;
      try {
        const match = await findStudentPhoto(supabase, bucketNameForClass(classCode), trimmedId);
        // Naming the file and its version lets /api/photo skip a second storage
        // listing and lets the browser reuse the image across scans.
        return match ? photoUrlForStudent(trimmedId, photoVersion(match), match.name) : null;
      } catch (e) {
        console.error("Image preparation error:", e);
        return null;
      }
    })(), PHOTO_LOOKUP_TIMEOUT_MS, null);

    let gasResponse;
    try {
      gasResponse = await gasPromise;
    } catch (e) {
      console.error(`GAS request for class ${classCode} failed:`, e);
      return res.status(504).json({ status: "error", message: "Server presensi tidak merespons" });
    }
    const imageUrl = await imagePromise;

    const { data, text, valid } = await readJsonResponse(gasResponse);
    if (!valid || !data || typeof data !== 'object') {
      console.error(`GAS response for class ${classCode} is not JSON:`, String(text).slice(0, 200));
      return res.status(502).json({ status: "error", message: "Server presensi mengembalikan respons tidak valid" });
    }

    if (isBusyResponse(data)) {
      return res.status(503).json({ status: "busy", message: "Server sibuk, mencoba ulang" });
    }

    // Never pass the raw sheet image value through; photos are served only by /api/photo.
    delete data.image;
    if ((data.status === 'ok' || data.status === 'duplicate') && imageUrl) {
      data.image = imageUrl;
    }
    if (data.status === 'error') {
      console.error(`GAS error for class ${classCode}:`, data.message);
      data.message = 'Gagal mencatat presensi';
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("POST error:", err);
    return res.status(500).json({ status: "error", message: "Terjadi kesalahan server" });
  }
}
