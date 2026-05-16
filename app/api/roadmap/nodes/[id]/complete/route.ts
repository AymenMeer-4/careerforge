/**
 * POST /api/roadmap/nodes/[id]/complete
 *
 * Marks a roadmap node as completed, then triggers readiness recompute.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { computeStudentDimensions } from '@/lib/readiness';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify the node belongs to this student
    const [node] = await sql`
      SELECT * FROM roadmap_nodes
      WHERE id = ${id} AND student_id = ${session.userId}
    `;

    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    // Mark complete
    const [updated] = await sql`
      UPDATE roadmap_nodes
      SET status = 'completed', completed_at = NOW()
      WHERE id = ${id} AND student_id = ${session.userId}
      RETURNING *
    `;

    // Trigger readiness recompute so the dashboard ring updates
    await computeStudentDimensions(session.userId);

    return NextResponse.json({ node: updated, success: true });
  } catch (error: any) {
    console.error('POST /api/roadmap/nodes/[id]/complete error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
