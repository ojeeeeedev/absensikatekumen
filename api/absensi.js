import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

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
  let SCRIPT_MAP = {};
  try {
    // In a Vercel environment, the variable MUST exist.
    if (!process.env.VERCEL_SCRIPT_MAP_JSON) {
      // This will cause the function to fail if the env var is not set.
      throw new Error("Server configuration error: VERCEL_SCRIPT_MAP_JSON is not defined.");
    }
    SCRIPT_MAP = JSON.parse(process.env.VERCEL_SCRIPT_MAP_JSON);
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
      const token = req.headers.authorization?.split(' ')[1];
      if (!token || !jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })) {
        return res.status(401).json({ status: 'error', message: 'Akses ditolak: Token tidak valid' });
      }

      const { studentId } = req.body;
      const classCode = studentId?.split('/')[1]?.toUpperCase();

      const scriptURL = SCRIPT_MAP[classCode];
      if (!scriptURL) {
        return res.status(400).json({
          status: "error",
          message: `Invalid classCode: ${classCode}`,
        });
      }

      // --- OPTIMIZATION: Parallelize GAS fetch and Supabase Image preparation ---
      const filename = studentId.replace(/\//g, '-') + '.jpg';
      
      // Determine bucket name based on class code
      const bucketName = `pasfoto-${classCode.toLowerCase()}`;

      const [gasResponse, supabaseUrlResult] = await Promise.all([
        fetch(scriptURL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req.body),
        }),
        supabase 
          ? supabase.storage.from(bucketName).createSignedUrl(filename, 60)
          : Promise.resolve({ data: null, error: null })
      ]);

      const text = await gasResponse.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return res.status(200).send(text);
      }

      // Inject image if we got a URL and GAS was successful
      if (data.status === 'ok' && supabaseUrlResult?.data?.signedUrl) {
        data.image = supabaseUrlResult.data.signedUrl;
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
