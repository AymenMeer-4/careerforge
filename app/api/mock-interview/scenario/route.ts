/**
 * GET /api/mock-interview/scenario
 *
 * Returns one scenario matching the student's cluster from
 * data/mock-interview-scenarios.json.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import scenarios from '@/data/mock-interview-scenarios.json';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [student] = await sql`SELECT cluster FROM students WHERE user_id = ${session.userId}`;
    const cluster: string = student?.cluster ?? 'tech';

    const all = scenarios as Record<string, any[]>;
    const pool = all[cluster] && all[cluster].length > 0 ? all[cluster] : all['tech'];
    const scenario = pool[Math.floor(Math.random() * pool.length)];

    return NextResponse.json({ scenario });
  } catch (error: any) {
    console.error('GET /api/mock-interview/scenario error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
