import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { computeStudentDimensions } from '@/lib/readiness';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    await sql`
      DELETE FROM student_experiences 
      WHERE id = ${id} AND student_id = ${session.userId}
    `;

    // Recompute scores
    await computeStudentDimensions(session.userId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting experience:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
