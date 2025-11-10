export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const response = await

function handleScan(decodedText) {
  console.log("QR scanned:", JSON.stringify(decodedText), "length:", decodedText.length);
  const week = document.getElementById("week").value;
  showStatus("⏳ Mengirim data...", "");

  fetch("https://absensikatekumen.vercel.app/api/absensi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId: decodedText, week }),
  })
  .then(r => r.json())
  .then(res => {
    console.log("Server response:", res);
    if (res.status === "ok") {
      showStatus(`✅ ${res.message}`, "success");
    } else {
      showStatus("❌ Data tidak ditemukan!", "error");
    }
  })
  .catch(err => {
    console.error(err);
    showStatus("⚠️ Koneksi error!", "error");
  });
}


fetch("https://script.google.com/macros/s/AKfycbzGulltOw_shGytVbCSfzPX-qWD8rKV2ZVQYvv_Yhg1zjbecAGUDcVPL99B0o6NGUSOiQ/exec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });

      const data = await response.text();

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.status(200).send(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ status: "error", message: err.message });
    }
  } else if (req.method === "OPTIONS") {
    // Handle preflight
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(200).end();
  } else {
    res.status(405).end();
  }
}
