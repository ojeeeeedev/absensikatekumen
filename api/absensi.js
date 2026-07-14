import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { verifyJwt } from './_auth.js';
import { getScriptMap, readJsonResponse } from './_gas-utils.js';
import { bucketNameForClass, classCodeFromStudentId, findStudentPhoto, photoUrlForStudent } from './_supabase-utils.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // --- Authentication Secrets ---
  const SHARED_SECRET = process.env.AUTH_SECRET;
  const JWT_SECRET = process.env.JWT_SECRET;
  
  // --- Supabase Configuration ---
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const supabase = (SUPABASE_URL && SUPABASE_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

  // --- Mapping for your sheets (loaded from environment variable) ---
  let SCRIPT_MAP;
  try {
    SCRIPT_MAP = getScriptMap();
  } catch (e) {
    console.error("Error parsing VERCEL_SCRIPT_MAP_JSON:", e);
    // Return a generic server error to the client
    return res.status(500).json({ status: "error", message: "Server parsing configuration error." });
  }
  // --- End SCRIPT_MAP loading ---

  // ============================================================
  // 2️⃣ HANDLE POST  →  Save absensi or Login
  // ============================================================
  if (req.method === "POST") {
    try {
      // Check if it's a login action
      if (req.body.action === 'login') {
        if (!SHARED_SECRET || !JWT_SECRET) {
          return res.status(500).json({ status: 'error', message: 'Server authentication is not configured' });
        }
        const providedSecret = Buffer.from(String(req.body.secret || ''));
        const storedSecret = Buffer.from(String(SHARED_SECRET || ''));
        
        if (providedSecret.length === storedSecret.length && 
            crypto.timingSafeEqual(providedSecret, storedSecret)) {
          // Secret is correct, issue a token
          const token = jwt.sign(
            { authorized: true }, // payload
            JWT_SECRET,
            { expiresIn: '8h' } // Token expires in 8 hours
          );
          return res.status(200).json({ status: 'ok', token });
        } else {
          // Incorrect secret
          return res.status(401).json({ status: 'error', message: 'Password salah' });
        }
      } 
      
      // If not login, handle it as an attendance submission
      // --- Token validation for this specific action is required ---
      try {
        verifyJwt(req);
      } catch (err) {
        return res.status(401).json({ status: 'error', message: 'Akses ditolak: Token tidak valid' });
      }

      const { studentId } = req.body;
      const classCode = classCodeFromStudentId(studentId);
      if (!classCode) {
        return res.status(400).json({ status: "error", message: "Format studentId tidak valid" });
      }

      const scriptURL = SCRIPT_MAP[classCode];
      if (!scriptURL) {
        return res.status(400).json({
          status: "error",
          message: `Invalid classCode: ${classCode}`,
        });
      }

      const GAS_SECRET_KEY = process.env.GAS_SECRET_KEY;
      if (!GAS_SECRET_KEY) {
        return res.status(500).json({ status: "error", message: "Server GAS authentication is not configured" });
      }

      // --- OPTIMIZATION: Parallelize GAS fetch and Supabase Image preparation ---
      const bucketName = bucketNameForClass(classCode);

      // Start GAS fetch
      const gasPromise = fetch(scriptURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...req.body,
          api_secret: GAS_SECRET_KEY
        }),
      });

      // Start Supabase Image preparation (Search then Sign)
      const imagePromise = (async () => {
        if (!supabase) return null;
        try {
          const match = await findStudentPhoto(supabase, bucketName, studentId);
          return match ? photoUrlForStudent(studentId) : null;
        } catch (e) {
          console.error("[DEBUG] Image preparation error:", e);
          return null;
        }
      })();

      const [gasResponse, imageUrl] = await Promise.all([gasPromise, imagePromise]);

      const { data, text, valid } = await readJsonResponse(gasResponse);
      if (!valid) {
        console.error(`GAS response for class ${classCode} (${scriptURL}) is not JSON:`, text);
        return res.status(502).json({
          status: "error",
          message: `Google Apps Script for class "${classCode}" returned invalid JSON (HTML or plain text instead)`,
          details: `Response: ${text.substring(0, 100)}`
        });
      }

      // Inject same-origin image URL if GAS was successful or returned duplicate (SUDAH ABSEN)
      if ((data.status === 'ok' || data.status === 'duplicate') && imageUrl) {
        data.image = imageUrl;
      }

      return res.status(200).json(data);

    } catch (err) {
      console.error("POST error:", err);
      return res.status(500).json({ status: "error", message: err.message });
    }
  }

  // ============================================================
  // Invalid method
  // ============================================================
  return res.status(405).json({ status: "error", message: `Method ${req.method} not allowed` });
}
