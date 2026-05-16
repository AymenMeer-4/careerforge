/**
 * GET /api/corporates/applicants/recent
 * Recent applicants across all of this corporate's jobs (dashboard feed).
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'corporate') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const applicants = await sql`
      SELECT a.id AS application_id, a.job_id, a.status, a.match_score, a.applied_at,
             u.name, j.title AS job_title
      FROM applications a
      JOIN jobs j ON j.id = a.job_id
      JOIN users u ON u.id = a.student_id
      WHERE j.corporate_id = ${session.userId}
      ORDER BY a.applied_at DESC
      LIMIT 10
    `;
    return NextResponse.json({ applicants });
  } catch (error: any) {
    console.error('GET /api/corporates/applicants/recent error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
