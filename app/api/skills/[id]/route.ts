/**
 * DELETE /api/skills/[id]
 * Removes a skill row owned by the current student, then recomputes readiness.
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { computeStudentDimensions } from '@/lib/readiness';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const deleted = await sql`
      DELETE FROM student_skills
      WHERE id = ${id} AND student_id = ${session.userId}
      RETURNING id
    `;
    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    let dimensions = null;
    try {
      dimensions = await computeStudentDimensions(session.userId);
    } catch (recomputeErr) {
      console.error('skills/[id] DELETE: readiness recompute failed', recomputeErr);
    }

    return NextResponse.json({ ok: true, dimensions });
  } catch (error: any) {
    console.error('DELETE /api/skills/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
