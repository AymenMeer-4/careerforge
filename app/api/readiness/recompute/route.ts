import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { computeStudentDimensions } from '@/lib/readiness';

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await computeStudentDimensions(session.userId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error recomputing readiness:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
