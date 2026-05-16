/**
 * GET /api/insights/market-demand
 *
 * Market Demand Trends: count of jobs requiring each skill, across all open
 * jobs (Section 5.8).
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { asArray } from '@/lib/job-helpers';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const jobs = await sql`SELECT required_skills FROM jobs WHERE status = 'open'`;

    const counts: Record<string, number> = {};
    for (const job of jobs) {
      const skills = asArray<{ skill: string }>(job.required_skills);
      const seen = new Set<string>();
      for (const s of skills) {
        if (!s?.skill || seen.has(s.skill)) continue;
        seen.add(s.skill);
        counts[s.skill] = (counts[s.skill] ?? 0) + 1;
      }
    }

    const demand = Object.entries(counts)
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({ demand });
  } catch (error: any) {
    console.error('GET /api/insights/market-demand error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
