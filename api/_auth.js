import jwt from 'jsonwebtoken';

const AUTH_COOKIE_MAX_AGE = 60 * 60;

export function setAuthCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `auth_token=${encodeURIComponent(token)}; Path=/; Max-Age=${AUTH_COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Strict`,
  );
}

export function clearAuthCookie(res) {
  res.setHeader(
    'Set-Cookie',
    'auth_token=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict',
  );
}

export function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

export function getCookieToken(req) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function verifyJwt(req, { allowCookie = false } = {}) {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET || Buffer.byteLength(JWT_SECRET) < 32) {
    throw Object.assign(new Error('JWT_SECRET is not configured'), { statusCode: 500 });
  }

  const token = getBearerToken(req) || (allowCookie ? getCookieToken(req) : null);
  if (!token) {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (payload.authorized !== true) throw new Error('Unauthorized');
    return payload;
  } catch {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
  }
}
