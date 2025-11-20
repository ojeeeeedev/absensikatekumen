import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // --- Authentication Secrets ---
  const SHARED_SECRET = process.env.AUTH_SECRET || "your-very-secret-password";
  const JWT_SECRET = process.env.JWT_SECRET || "another-super-secret-key";

  // Mapping for your sheets
  const SCRIPT_MAP = {
    SAB: "https://script.google.com/macros/s/AKfycbxB3TcQA-bsX5hgXi4mL1v__-RL4HGzy8D6QJdeWy0-x737yw3sTGxvFbFdEc07zJfepQ/exec",
    ROM: "https://script.google.com/macros/s/AKfycby8cp12Ck9BvHWe4S3kg8kW6D-Trhe2SX9snlwUy17RLUbBHBhRwfNvh0S1dLWJrxcyQA/exec",
  };

  // ============================================================
  // 0️⃣ HANDLE LOGIN
  // ============================================================
  if (req.method === "POST" && req.body.action === 'login') {
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
    return; // Stop execution after handling login
  }

  // ============================================================
  // --- All other requests below this point require a valid token ---
  // ============================================================
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || !jwt.verify(token, JWT_SECRET)) {
    return res.status(401).json({ status: 'error', message: 'Akses ditolak: Token tidak valid' });
  }

  // ============================================================
  // 1️⃣ HANDLE GET  →  loadTopikList()
  // ============================================================
  if (req.method === "GET") {
    try {
      const { action, classCode } = req.query;

      if (action === "topik") {
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
  // 2️⃣ HANDLE POST  →  Save absensi
  // ============================================================
  if (req.method === "POST") {
    try {
      const { classCode } = req.body;

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
      return res.status(200).send(text);

    } catch (err) {
      console.error("POST error:", err);
      return res.status(500).json({ status: "error", message: err.message });
    }
  }

  // ============================================================
  // Invalid method
  // ============================================================
  return res.status(405).json({ status: "error", message: "Method not allowed" });
}
