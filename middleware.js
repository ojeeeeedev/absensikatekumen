import { NextResponse } from 'next/server';

export const config = {
  // Only run middleware for the /dashboard route to improve performance
  matcher: '/dashboard',
};

export default function middleware(req) {
  // Use an environment variable for the internal path to keep it out of source code.
  // Ensure DASHBOARD_PATH is set to "/api/dashboard" in your Vercel Project Settings.
  const internalPath = process.env.DASHBOARD_PATH || '/api/dashboard';

  return NextResponse.rewrite(new URL(internalPath, req.url));
}