import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';
import { z } from 'zod';

export const runtime = 'nodejs';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = loginSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    
    const { email, password } = result.data;
    
    const users = await sql`
      SELECT u.id, u.password_hash, u.role, s.onboarding_completed_at
      FROM users u
      LEFT JOIN students s ON u.id = s.user_id
      WHERE u.email = ${email}
      LIMIT 1
    `;
    
    if (users.length === 0) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    
    const user = users[0];
    
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
    session.userId = user.id;
    session.role = user.role;
    await session.save();
    
    let onboardingCompleted = true;
    if (user.role === 'student') {
      onboardingCompleted = user.onboarding_completed_at !== null;
    }
    
    return NextResponse.json({ role: user.role, onboardingCompleted });
    
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
