import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { computeStudentDimensions } from '@/lib/readiness';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const courses = body.courses;

    if (!Array.isArray(courses)) {
      return NextResponse.json({ error: 'Courses must be an array' }, { status: 400 });
    }

    // Replace all existing rows
    await sql`
      DELETE FROM student_courses WHERE student_id = ${session.userId}
    `;

    if (courses.length > 0) {
      const values = courses.map(c => ({
        student_id: session.userId,
        course_name: c.course_name,
        course_code: c.course_code || null,
        credits: c.credits ? parseFloat(c.credits) : null,
        grade: c.grade || null,
        semester: c.semester || null,
        source: c.source || 'manual'
      }));

      await sql`
        INSERT INTO student_courses ${sql(values)}
      `;
    }

    // Recompute scores
    await computeStudentDimensions(session.userId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error saving courses:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
