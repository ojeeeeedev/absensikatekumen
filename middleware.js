export const config = {
  // Only run middleware for the /dashboard route to improve performance
  matcher: '/dashboard',
};

export default function middleware(req) {
  const url = new URL(req.url);
  const internalPath = process.env.DASHBOARD_PATH || '/api/dashboard';

  // Construct the destination URL (e.g., https://yourdomain.com/api/dashboard)
  const destination = new URL(internalPath, url.origin);

  // Use the standard Web Response with the Vercel rewrite header.
  // This performs an internal rewrite without changing the URL in the browser.
  return new Response(null, {
    headers: {
      'x-middleware-rewrite': destination.toString(),
    },
  });
}