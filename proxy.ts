import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { unsealData } from 'iron-session';

export async function proxy(req: NextRequest) {
  const cookieName = 'careerforge_session';
  const cookie = req.cookies.get(cookieName);
if (!cookie || !cookie.value || cookie.value.trim() === '') {
  return NextResponse.redirect(new URL('/login', req.url));
}

  let sessionData: any;
  try {
    const password = process.env.SESSION_PASSWORD;
    if (!password) {
      console.error('SESSION_PASSWORD is not set in middleware');
      return NextResponse.redirect(new URL('/login', req.url));
    }

    sessionData = await unsealData(cookie.value, {
      password: password,
    });
  } catch (error) {
    console.error('Failed to unseal session data:', error);
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (!sessionData || !sessionData.userId) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const role = sessionData.role;
  const path = req.nextUrl.pathname;

  // Student routes
  const studentRoutes = [
    '/dashboard', '/profile', '/skills', '/roadmap', '/simulator', 
    '/insights', '/mock-interview', '/jobs', '/applications'
  ];
  if (studentRoutes.some(r => path.startsWith(r))) {
    if (role !== 'student') {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  // Corporate routes
  const corporateRoutes = [
    '/corporate/dashboard', '/corporate/post-job', '/corporate/jobs'
  ];
  if (corporateRoutes.some(r => path.startsWith(r))) {
    if (role !== 'corporate') {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/profile/:path*',
    '/skills/:path*',
    '/roadmap/:path*',
    '/simulator/:path*',
    '/insights/:path*',
    '/mock-interview/:path*',
    '/jobs/:path*',
    '/applications/:path*',
    '/corporate/dashboard/:path*',
    '/corporate/post-job/:path*',
    '/corporate/jobs/:path*',
  ],
};
