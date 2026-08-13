import { verifyJwt } from './api/_auth.js';
import { next } from '@vercel/functions';

export const config = {
  matcher: ['/dashboard', '/api/students', '/api/photo'],
  runtime: 'nodejs',
};

export default function middleware(req) {
  const url = new URL(req.url);

  const protectedApiRequest =
    (url.pathname === '/api/students' && req.method === 'GET') ||
    (url.pathname === '/api/photo' && (req.method === 'GET' || req.method === 'HEAD'));

  if (protectedApiRequest) {
    try {
      verifyJwt({
        headers: {
          authorization: req.headers.get('authorization') || '',
          cookie: req.headers.get('cookie') || '',
        },
      }, { allowCookie: true });
    } catch {
      return Response.json(
        { status: 'error', message: 'Unauthorized' },
        { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } },
      );
    }
  }

  if (url.pathname === '/dashboard') {
    const token = (req.headers.get('cookie') || '')
      .match(/(?:^|;\s*)auth_token=([^;]+)/)?.[1];
    if (!token) return Response.redirect(new URL('/', req.url));

    const internalPath = process.env.DASHBOARD_PATH || '/api/dashboard';
    return Response.rewrite(new URL(internalPath, req.url));
  }

  return next();
}
