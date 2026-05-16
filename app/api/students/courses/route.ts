import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { computeStudentDimensions } from '@/lib/readiness';

const CoursesSchema = z.object({
  courses: z.array(z.object({
    course_name: z.string().min(1).max(200),
    course_code: z.string().max(50).optional().nullable(),
    credits: z.union([z.string(), z.number()]).optional().nullable(),
    grade: z.string().max(20).optional().nullable(),
    semester: z.string().max(50).optional().nullable(),
    source: z.enum(['manual', 'transcript_vision']).optional(),
  })).max(60),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CoursesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid courses data' }, { status: 400 });
    }
    const courses = parsed.data.courses;

    // Replace all existing rows
    await sql`
      DELETE FROM student_courses WHERE student_id = ${session.userId}
    `;

    if (courses.length > 0) {
      const values = courses.map(c => ({
        student_id: session.userId,
        course_name: c.course_name,
        course_code: c.course_code || null,
        credits: c.credits != null && c.credits !== '' && !Number.isNaN(Number(c.credits))
          ? Number(c.credits)
          : null,
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
