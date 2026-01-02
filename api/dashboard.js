export default function handler(req, res) {
  const dashboardUrl = process.env.DASHBOARD_URL;

  if (!dashboardUrl) {
    return res.status(500).send("Dashboard URL not configured on server.");
  }

  // 307 Temporary Redirect preserves the method, though for a link click 302/307 are fine.
  res.redirect(307, dashboardUrl);
}
