/**
 * GET /api/roadmap
 * Returns the current student's roadmap nodes, sorted by tier then order_index.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const nodes = await sql`
      SELECT * FROM roadmap_nodes
      WHERE student_id = ${session.userId}
      ORDER BY tier ASC, order_index ASC
    `;

    return NextResponse.json({ nodes });
  } catch (error: any) {
    console.error('GET /api/roadmap error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
