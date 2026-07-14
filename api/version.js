import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader('Allow', 'GET, HEAD, OPTIONS');
    return res.status(405).json({ status: 'error', message: `Method ${req.method} not allowed` });
  }

  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).json({ version: pkg.version });
  } catch (error) {
    console.error("Error reading version:", error);
    return res.status(500).json({ error: error.message });
  }
}
