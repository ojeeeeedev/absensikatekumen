import { verifyJwt } from './_auth.js';

export default function handler(req, res) {
  try {
    verifyJwt(req, { allowCookie: true });
  } catch {
    // Missing or expired session: send the facilitator to the login screen.
    return res.redirect(302, '/');
  }

  const dashboardUrl = process.env.DASHBOARD_URL;

  if (!dashboardUrl) {
    return res.status(500).send("Dashboard URL not configured on server.");
  }

  res.redirect(307, dashboardUrl);
}
