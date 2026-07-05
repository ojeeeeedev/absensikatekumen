import { verifyJwt } from './_auth.js';

export default function handler(req, res) {
  try {
    verifyJwt(req, { allowCookie: true });
  } catch {
    return res.status(401).send("Unauthorized");
  }

  const dashboardUrl = process.env.DASHBOARD_URL;

  if (!dashboardUrl) {
    return res.status(500).send("Dashboard URL not configured on server.");
  }

  // 307 Temporary Redirect preserves the method, though for a link click 302/307 are fine.
  res.redirect(307, dashboardUrl);
}
