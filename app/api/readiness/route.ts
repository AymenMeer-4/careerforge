import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [dimensions] = await sql`
      SELECT * FROM student_dimensions WHERE student_id = ${session.userId}
    `;

    if (!dimensions) {
      return NextResponse.json({ error: 'Not computed yet' }, { status: 404 });
    }

    return NextResponse.json(dimensions);
  } catch (error: any) {
    console.error('Error fetching readiness:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
