import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const STUDENT_ROUTES = ['/dashboard', '/profile', '/skills', '/roadmap', '/simulator', '/insights', '/mock-interview', '/jobs', '/applications'];
const CORPORATE_ROUTES = ['/corporate/dashboard', '/corporate/post-job', '/corporate/jobs'];

export function proxy(request: NextRequest) {
  const session = request.cookies.get('careerforge_session');
  const { pathname } = request.nextUrl;

  const isStudentRoute = STUDENT_ROUTES.some(r => pathname.startsWith(r));
  const isCorporateRoute = CORPORATE_ROUTES.some(r => pathname.startsWith(r));

  if ((isStudentRoute || isCorporateRoute) && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
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
