import { verifyJwt } from './_auth.js';
import { getScriptMap, readJsonResponse } from './_gas-utils.js';
import { photoUrlForStudent, storageBaseNameForStudent } from './_supabase-utils.js';

/**
 * Returns the GAS student roster with authenticated same-origin photo URLs.
 * The browser loads those photos independently so storage latency does not
 * block names and IDs from rendering.
 */
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
  
  let SCRIPT_MAP;
  try {
    SCRIPT_MAP = getScriptMap();
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
    return res.status(500).json({ status: "error", message: "Server GAS authentication is not configured" });
  }

  const photosEnabled = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);

  try {
    const gasResponse = await fetch(scriptURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "getStudentList",
        api_secret: GAS_SECRET_KEY
      })
    });

    const { data, text, valid } = await readJsonResponse(gasResponse);
    if (!valid) {
      console.error(`GAS response is not JSON: ${text}`);
      return res.status(502).json({ status: "error", message: "GAS returned invalid JSON" });
    }

    if (data.status !== "ok" || !data.students) {
      return res.status(502).json({ status: "error", message: data.message || "Failed to fetch students from sheet" });
    }

    const students = data.students.map(student => ({
      ...student,
      image: photosEnabled && storageBaseNameForStudent(student.studentId)
        ? photoUrlForStudent(student.studentId)
        : ''
    }));

    return res.status(200).json({ status: "ok", students });
  } catch (err) {
    console.error("API Error in /api/students:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
}
