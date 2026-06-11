import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { resolve } from 'path';

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

  const JWT_SECRET = process.env.JWT_SECRET;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ status: "error", message: "Unauthorized" });
  }

  try {
    jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch (e) {
    return res.status(401).json({ status: "error", message: "Unauthorized" });
  }

  try {
    let classNames = {};
    try {
      const classCodePath = resolve(process.cwd(), 'classcode.json');
      classNames = JSON.parse(readFileSync(classCodePath, 'utf8'));
    } catch (err) {
      console.error("Error reading classcode.json:", err);
    }

    const map = JSON.parse(process.env.VERCEL_SCRIPT_MAP_JSON || "{}");
    const classes = Object.keys(map)
      .filter(code => code !== "YOUR_CLASS_CODE_HERE")
      .map(code => ({
        code: code,
        name: classNames[code] || code
      }));

    return res.status(200).json({ status: "ok", classes });
  } catch (e) {
    console.error("Error in /api/classes:", e);
    return res.status(500).json({ status: "error", message: "Server config error" });
  }
}
