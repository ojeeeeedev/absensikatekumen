import jwt from 'jsonwebtoken';

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

function getCookieToken(req) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function verifyJwt(req, { allowCookie = false } = {}) {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    throw Object.assign(new Error('JWT_SECRET is not configured'), { statusCode: 500 });
  }

  const token = getBearerToken(req) || (allowCookie ? getCookieToken(req) : null);
  if (!token) {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
  }

  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
  }
}
