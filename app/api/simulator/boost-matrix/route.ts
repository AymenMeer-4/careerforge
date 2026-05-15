/**
 * GET /api/simulator/boost-matrix
 * Returns the DYNAMIC boost matrix (Section 8.5), computed live from job data,
 * plus the student's cluster and target role for the simulator UI.
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { computeBoostMatrix } from '@/lib/simulator';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [student] = await sql`
      SELECT cluster, target_role FROM students WHERE user_id = ${session.userId}
    `;
    if (!student) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    }

    // target_role may be stored as an array — normalize to a single role string.
    let targetRole: string | null = student.target_role ?? null;
    if (Array.isArray(targetRole)) targetRole = targetRole[0] ?? null;
    if (typeof targetRole === 'string' && targetRole.startsWith('[')) {
      try {
        const parsed = JSON.parse(targetRole);
        targetRole = Array.isArray(parsed) ? parsed[0] ?? null : targetRole;
      } catch { /* keep as-is */ }
    }

    const matrix = await computeBoostMatrix(student.cluster);
    return NextResponse.json({
      matrix,
      cluster: student.cluster,
      target_role: targetRole,
    });
  } catch (error: any) {
    console.error('GET /api/simulator/boost-matrix error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
