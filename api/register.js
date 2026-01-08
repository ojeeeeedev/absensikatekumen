export default function handler(req, res) {
  const daftarUrl = process.env.DAFTAR_URL;

  if (!daftarUrl) {
    return res.status(500).send("Daftar URL not configured on server.");
  }

  // 307 Temporary Redirect preserves the method, though for a link click 302/307 are fine.
  res.redirect(307, daftarUrl);
}
