export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send(`Method ${req.method} not allowed`);
  }

  const daftarUrl = process.env.DAFTAR_URL;

  if (!daftarUrl) {
    return res.status(500).send("Daftar URL not configured on server.");
  }

  // 307 Temporary Redirect preserves the method, though for a link click 302/307 are fine.
  res.redirect(307, daftarUrl);
}
