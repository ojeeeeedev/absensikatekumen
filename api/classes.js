import jwt from 'jsonwebtoken';

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
    const map = JSON.parse(process.env.VERCEL_SCRIPT_MAP_JSON || "{}");
    const classes = Object.keys(map);
    return res.status(200).json({ status: "ok", classes });
  } catch (e) {
    return res.status(500).json({ status: "error", message: "Server config error" });
  }
}
