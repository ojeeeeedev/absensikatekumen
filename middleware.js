export default function middleware(req) {
  const url = new URL(req.url);

  if (url.pathname === '/dashboard') {
    const token = req.cookies.get('auth_token');
    if (!token) return Response.redirect(new URL('/', req.url));

    return Response.rewrite(new URL('/public/dashboard.html', req.url));
  }
}
