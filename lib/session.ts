import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

export type Role = 'student' | 'corporate';

export interface SessionData {
  userId: string;
  role: Role;
}

const sessionPassword = process.env.SESSION_PASSWORD;

if (!sessionPassword || sessionPassword.length < 32) {
  throw new Error('SESSION_PASSWORD environment variable must be at least 32 characters');
}

export const sessionOptions = {
  password: sessionPassword,
  cookieName: 'careerforge_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  if (!session.userId) {
    return null;
  }

  return session;
}

export async function requireSession(role?: Role) {
  const session = await getSession();

  if (!session) {
    throw new Error('Unauthorized'); // Basic return for now; real impl might redirect or use NextResponse
  }

  if (role && session.role !== role) {
    throw new Error('Forbidden');
  }

  return session;
}
