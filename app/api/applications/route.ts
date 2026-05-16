/**
 * GET /api/applications
 *
 * Returns the current student's applications joined with job + corporate info.
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

    const applications = await sql`
      SELECT
        a.id, a.status, a.match_score, a.applied_at, a.status_changed_at,
        a.rejection_primary_reason, a.rejection_gap_tags, a.rejection_comment,
        j.id AS job_id, j.title, j.posting_type, j.role_category,
        j.location_region, j.location_city, j.salary_min, j.salary_max,
        c.company_name, c.verification_status
      FROM applications a
      JOIN jobs j ON j.id = a.job_id
      JOIN corporates c ON c.user_id = j.corporate_id
      WHERE a.student_id = ${session.userId}
      ORDER BY a.applied_at DESC
    `;

    return NextResponse.json({ applications });
  } catch (error: any) {
    console.error('GET /api/applications error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
