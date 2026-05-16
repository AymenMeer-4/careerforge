/**
 * POST /api/corporates/applications/[id]/status — Section 7 / 6.5
 * Body: { status } where status ∈ {under_review, interview, offered}.
 * Updates status + status_changed_at. Sends a Resend email when status
 * becomes 'interview' (interview notice) or 'offered' (offer + corporate
 * contact info). Email failure is reported but does not fail the status change.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { sendInterviewEmail, sendOfferEmail } from '@/lib/email';

const BodySchema = z.object({
  status: z.enum(['under_review', 'interview', 'offered']),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'corporate') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { status } = parsed.data;

    const [row] = await sql`
      SELECT a.id, j.title AS job_title,
             stu_u.email AS student_email, stu_u.name AS student_name,
             stu_u.language_pref AS student_lang,
             c.company_name, corp_u.email AS corporate_email, corp_u.phone AS corporate_phone
      FROM applications a
      JOIN jobs j ON j.id = a.job_id
      JOIN corporates c ON c.user_id = j.corporate_id
      JOIN users corp_u ON corp_u.id = c.user_id
      JOIN users stu_u ON stu_u.id = a.student_id
      WHERE a.id = ${id} AND j.corporate_id = ${session.userId}
    `;
    if (!row) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    await sql`
      UPDATE applications SET status = ${status}, status_changed_at = NOW() WHERE id = ${id}
    `;

    let email: { ok: boolean; error?: string } | null = null;
    if (status === 'interview') {
      email = await sendInterviewEmail({
        to: row.student_email,
        lang: row.student_lang === 'ar' ? 'ar' : 'en',
        studentName: row.student_name,
        companyName: row.company_name,
        jobTitle: row.job_title,
        corporateEmail: row.corporate_email,
        corporatePhone: row.corporate_phone,
      });
    } else if (status === 'offered') {
      email = await sendOfferEmail({
        to: row.student_email,
        lang: row.student_lang === 'ar' ? 'ar' : 'en',
        studentName: row.student_name,
        companyName: row.company_name,
        jobTitle: row.job_title,
        corporateEmail: row.corporate_email,
        corporatePhone: row.corporate_phone,
      });
    }

    return NextResponse.json({
      success: true,
      status,
      email_sent: email ? email.ok : undefined,
      email_error: email && !email.ok ? email.error : undefined,
    });
  } catch (error: any) {
    console.error('POST /api/corporates/applications/[id]/status error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
