export default async function handler(req, res) {
  // ========================
  // CORS
  // ========================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ========================
  // Load config.json dynamically
  // ========================
  async function loadScriptMap() {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`     // Production URL
      : `http://${req.headers.host}`;           // Local dev URL

    const response = await fetch(`${baseUrl}/config.json`);
    return response.json();
  }

  // ========================
  // GET → load topik
  // ========================
  if (req.method === "GET") {
    try {
      const { action, classCode } = req.query;

      if (action !== "topik") {
        return res.status(400).json({
          status: "error",
          message: "Invalid action",
        });
      }

      const SCRIPT_MAP = await loadScriptMap();
      const scriptURL = SCRIPT_MAP[classCode];

      if (!scriptURL) {
        return res.status(400).json({
          status: "error",
          message: "Invalid classCode",
        });
      }

      // Forward GET request to Apps Script
      const response = await fetch(`${scriptURL}?action=topik`);
      const text = await response.text();

      return res.status(200).send(text);
    } catch (err) {
      console.error("GET error:", err);
      return res.status(500).json({ status: "error", message: err.message });
    }
  }

  // ========================
  // POST → save absensi
  // ========================
  if (req.method === "POST") {
    try {
      const { classCode } = req.body;

      const SCRIPT_MAP = await loadScriptMap();
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

  // ========================
  // Invalid method
  // ========================
  return res.status(405).json({
    status: "error",
    message: "Method not allowed",
  });
}
