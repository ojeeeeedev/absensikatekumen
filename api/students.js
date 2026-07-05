import { createClient } from '@supabase/supabase-js';
import { verifyJwt } from './_auth.js';
import { bucketNameForClass, photoUrlForStudent, storageBaseNameForStudent } from './_supabase-utils.js';

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ status: "error", message: `Method ${req.method} not allowed` });
  }

  try {
    verifyJwt(req);
  } catch (err) {
    return res.status(401).json({ status: "error", message: "Akses ditolak: Token tidak valid" });
  }

  const { classCode } = req.query;
  if (!classCode) {
    return res.status(400).json({ status: "error", message: "Parameter classCode diperlukan" });
  }

  const normalizedClassCode = String(classCode).trim().toUpperCase();
  if (!/^[A-Z0-9]{2,5}$/.test(normalizedClassCode)) {
    return res.status(400).json({ status: "error", message: "Format classCode tidak valid" });
  }
  
  let SCRIPT_MAP = {};
  try {
    if (!process.env.VERCEL_SCRIPT_MAP_JSON) {
      throw new Error("Server configuration error: VERCEL_SCRIPT_MAP_JSON is not defined.");
    }
    SCRIPT_MAP = JSON.parse(process.env.VERCEL_SCRIPT_MAP_JSON);
  } catch (e) {
    console.error("Error parsing SCRIPT_MAP:", e);
    return res.status(500).json({ status: "error", message: "Server configuration error" });
  }

  const scriptURL = SCRIPT_MAP[normalizedClassCode];
  if (!scriptURL) {
    return res.status(400).json({ status: "error", message: `Invalid classCode: ${normalizedClassCode}` });
  }

  const GAS_SECRET_KEY = process.env.GAS_SECRET_KEY;
  if (!GAS_SECRET_KEY) {
    return res.status(500).json({ status: "error", message: "Server configuration error" });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

  try {
    const gasResponse = await fetch(scriptURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "getStudentList",
        api_secret: GAS_SECRET_KEY
      })
    });

    const text = await gasResponse.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error(`GAS response is not JSON: ${text}`);
      return res.status(502).json({ status: "error", message: "GAS returned invalid JSON" });
    }

    if (data.status !== "ok" || !data.students) {
      return res.status(502).json({ status: "error", message: data.message || "Failed to fetch students from sheet" });
    }

    const students = data.students;

    if (supabase && students.length > 0) {
      const bucketName = bucketNameForClass(normalizedClassCode);

      const { data: files, error: listError } = await supabase.storage
        .from(bucketName)
        .list('', { limit: 200 });

      if (!listError && files && files.length > 0) {
        const fileMap = {};
        files.forEach(f => {
          const parts = f.name.split('.');
          const ext = parts.pop()?.toLowerCase();
          const nameWithoutExt = parts.join('.').toLowerCase();
          if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
            fileMap[nameWithoutExt] = f.name;
          }
        });

        students.forEach(s => {
          const baseName = storageBaseNameForStudent(s.studentId)?.toLowerCase();
          if (baseName && fileMap[baseName]) {
            s.image = photoUrlForStudent(s.studentId);
          }
        });
      }
    }

    return res.status(200).json({ status: "ok", students });
  } catch (err) {
    console.error("API Error in /api/students:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
}
