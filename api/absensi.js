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
      // Google Apps Script endpoint
      const scriptURL = "https://script.google.com/macros/s/AKfycbxxmF5fXmowi7vp92mrWLfOCGHLZST84Y0TB1jEdMu0WURjs4Gb2ehBVtYv-iiDgzyMnQ/exec";

      // Forward the request body to the Apps Script
      const response = await fetch(scriptURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });

      // Get the response back from Apps Script
      const data = await response.text();

      // Pass it directly back to the frontend
      res.status(200).send(data);
    } catch (err) {
      console.error("Proxy error:", err);
      res.status(500).json({ status: "error", message: err.message });
    }
  } else {
    res.status(405).json({ status: "error", message: "Method not allowed" });
  }
}
