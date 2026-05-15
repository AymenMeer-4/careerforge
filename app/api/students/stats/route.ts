import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [{ count: expCount }] = await sql`
      SELECT COUNT(*)::int as count FROM student_experiences WHERE student_id = ${session.userId}
    `;
    const [{ count: certCount }] = await sql`
      SELECT COUNT(*)::int as count FROM student_experiences WHERE student_id = ${session.userId} AND type IN ('certificate', 'training')
    `;
    const [{ count: completedNodes }] = await sql`
      SELECT COUNT(*)::int as count FROM roadmap_nodes WHERE student_id = ${session.userId} AND status = 'completed'
    `;
    const [{ avg: mockAvg }] = await sql`
      SELECT COALESCE(AVG(total_score), 0)::float as avg FROM mock_interview_sessions WHERE student_id = ${session.userId}
    `;

    return NextResponse.json({
      expCount,
      certCount,
      completedNodes,
      mockAvg
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
