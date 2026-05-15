/**
 * GET /api/skills/current
 * Returns the student's manually-added skills (with live market demand counts)
 * plus the dimmer derived skills inferred from courses / experiences / interests.
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getCurrentSkills, getDerivedSkills } from '@/lib/skills';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [current, derived] = await Promise.all([
      getCurrentSkills(session.userId),
      getDerivedSkills(session.userId),
    ]);

    return NextResponse.json({ current, derived });
  } catch (error: any) {
    console.error('GET /api/skills/current error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
