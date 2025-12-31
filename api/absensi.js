const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

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
  // 1️⃣ HANDLE GET  →  loadTopikList()
  // ============================================================
  if (req.method === "GET") {
    try {
      const { action, classCode } = req.query;

      if (action === "topik") {
        // --- Token validation for this specific action ---
        const token = req.headers.authorization?.split(' ')[1];
        if (!token || !jwt.verify(token, JWT_SECRET)) {
          return res.status(401).json({ status: 'error', message: 'Akses ditolak: Token tidak valid' });
        }
        // --- End token validation ---

        const scriptURL = SCRIPT_MAP[classCode];

        if (!scriptURL) {
          return res.status(400).json({
            status: "error",
            message: "Invalid classCode",
          });
        }

        // Forward to App Script as GET
        const response = await fetch(`${scriptURL}?action=topik`);
        const text = await response.text();

        // Return whatever the script returns
        return res.status(200).send(text);
      }

      return res.status(400).json({ status: "error", message: "Invalid action" });
    } catch (err) {
      console.error("GET error:", err);
      return res.status(500).json({ status: "error", message: err.message });
    }
  }

  // ============================================================
  // 2️⃣ HANDLE POST  →  Save absensi or Login
  // ============================================================
  if (req.method === "POST") {
    try {
      // Check if it's a login action
      if (req.body.action === 'login') {
        if (req.body.secret === SHARED_SECRET) {
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
      if (!token || !jwt.verify(token, JWT_SECRET)) {
        return res.status(401).json({ status: 'error', message: 'Akses ditolak: Token tidak valid' });
      }

      // Extract classCode from the studentId on the backend
      const { studentId } = req.body;
      const classCode = studentId?.split('/')[1]?.toUpperCase();

      const scriptURL = SCRIPT_MAP[classCode];
      if (!scriptURL) {
        return res.status(400).json({
          status: "error",
          message: `Invalid classCode: ${classCode}`,
        });
      }

      const response = await fetch(scriptURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });

      const text = await response.text();

      // Attempt to inject Supabase Image URL if successful attendance
      if (supabase) {
        try {
          const data = JSON.parse(text);
          if (data.status === 'ok' && data.studentId) {
            // Construct the public URL for the image. 
            // Assumes bucket is 'profiles' and filename is the studentId with .jpg extension.
            // Note: studentId might contain slashes (e.g. "A/123"), which Supabase treats as folders.
            // Naming convention: 2025-SAB-001.png (replacing slashes with dashes)
            const filename = data.studentId.replace(/\//g, '-') + '.png';
            const bucketName = 'pasfoto-sab'; // ⚠️ CHECK: Must match Supabase Bucket ID exactly
            
            console.log(`[DEBUG] Processing StudentID: ${data.studentId} -> Filename: ${filename}`);

            // Check if file exists to prevent CORB errors on frontend
            const { data: files, error: listError } = await supabase.storage
              .from(bucketName)
              .list('', { limit: 1, search: filename });

            if (listError) {
              console.error("[DEBUG] Supabase List Error:", listError);
            } else {
              console.log(`[DEBUG] Supabase List Result (count: ${files?.length}):`, JSON.stringify(files));
            }

            if (files && files.find(f => f.name === filename)) {
              const { data: imageData, error: urlError } = await supabase.storage
                .from(bucketName)
                .createSignedUrl(filename, 60); // URL valid for 60 seconds
              
              if (urlError) {
                console.error("[DEBUG] Signed URL Error:", urlError);
              } else if (imageData && imageData.signedUrl) {
                console.log(`[DEBUG] Signed URL generated: ${imageData.signedUrl}`);
                data.image = imageData.signedUrl;
              }
            } else {
              console.log(`[DEBUG] File '${filename}' not found in bucket 'pasfoto-sab' root.`);
            }
          }
          return res.status(200).json(data);
        } catch (e) {
          console.error("[DEBUG] Error injecting image:", e);
          // If parsing fails or other error, return original text
          return res.status(200).send(text);
        }
      }

      return res.status(200).send(text);

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
