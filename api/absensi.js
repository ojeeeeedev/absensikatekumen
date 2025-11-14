export default async function handler(req, res) {
  // Allow CORS for all origins
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Handle POST request
if (req.method === "POST") {
  try {
    const { classCode } = req.body;

    // Load your mapping
    const SCRIPT_MAP = {
      SAB: "https://script.google.com/macros/s/PASTE_SAB_APP_SCRIPT_URL/exec",
      ROM: "https://script.google.com/macros/s/PASTE_ROM_APP_SCRIPT_URL/exec",
      PHI: "https://script.google.com/macros/s/PASTE_PHI_APP_SCRIPT_URL/exec"
    };

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

    const data = await response.text();
    res.status(200).send(data);

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }

} else {
  res.status(405).json({ status: "error", message: "Method not allowed" });
}

}
