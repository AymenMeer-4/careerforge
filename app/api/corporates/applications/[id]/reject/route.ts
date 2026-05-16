/**
 * POST /api/corporates/applications/[id]/reject — Section 6.6 / 7
 * Body: { primaryReason, gapTags: string[], comment? }
 *
 * On rejection the application is REMOVED. Before deleting, any structured gap
 * tags are promoted into the student's roadmap as tier-3 "close the gap" nodes
 * (so the student still benefits from the feedback even though the rejected
 * application no longer appears in either portal).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { computeStudentDimensions } from '@/lib/readiness';
import { computePoints, getDimensionWeight } from '@/lib/points';

export const REJECTION_REASONS = [
  'missing_skills',
  'insufficient_experience',
  'missing_credential',
  'better_candidate',
  'role_filled',
  'other',
] as const;

const BodySchema = z
  .object({
    primaryReason: z.enum(REJECTION_REASONS),
    gapTags: z.array(z.string().min(1)).default([]),
    comment: z.string().optional(),
  })
  .refine((b) => b.primaryReason !== 'other' || (b.comment ?? '').trim().length > 0, {
    message: 'A comment is required when the primary reason is "Other".',
    path: ['comment'],
  });

function titleize(tag: string): string {
  return tag
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

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
    const { gapTags } = parsed.data;

    // Ownership check — the application must belong to one of this corporate's jobs.
    const [app] = await sql`
      SELECT a.id, a.student_id, j.cluster
      FROM applications a
      JOIN jobs j ON j.id = a.job_id
      WHERE a.id = ${id} AND j.corporate_id = ${session.userId}
    `;
    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    const studentId = app.student_id as string;
    const cluster: string = app.cluster ?? 'tech';

    // Promote gap tags into the student's roadmap before the application is removed.
    const tags = [...new Set(gapTags)];
    if (tags.length > 0) {
      const existing = await sql`
        SELECT title_en, description_en FROM roadmap_nodes WHERE student_id = ${studentId}
      `;
      const [{ max_idx }] = await sql`
        SELECT COALESCE(MAX(order_index), -1) AS max_idx FROM roadmap_nodes WHERE student_id = ${studentId}
      `;
      let orderIndex = (max_idx as number) + 1;
      const dimensionTarget = 'domain';

      for (const tag of tags) {
        const label = titleize(tag);
        const hasMatch = existing.some((n: any) => {
          const hay = `${n.title_en} ${n.description_en}`.toLowerCase();
          return hay.includes(tag.toLowerCase()) || hay.includes(label.toLowerCase());
        });
        if (hasMatch) continue;

        const difficulty = 3;
        const hours = 12;
        const tier = 3;
        const points = computePoints(difficulty, hours, getDimensionWeight(cluster, dimensionTarget), tier);

        await sql`
          INSERT INTO roadmap_nodes (
            student_id, title_en, title_ar, description_en, description_ar,
            dimension_target, difficulty, hours, points, tier, status,
            order_index, resources, why_this_tier
          ) VALUES (
            ${studentId},
            ${`Close gap: ${label}`},
            ${`سد الفجوة: ${label}`},
            ${`Build up ${label} — flagged as a gap in a job rejection. Practice and document this skill so it strengthens your profile.`},
            ${`عزّز مهارة ${label} — تم تحديدها كفجوة في رفض وظيفي. تدرّب على هذه المهارة ووثّقها لتقوية ملفك.`},
            ${dimensionTarget}, ${difficulty}, ${hours}, ${points}, ${tier}, 'unlocked',
            ${orderIndex}, ${JSON.stringify([])},
            ${'EN: Added from a rejected application gap. ||| AR: تمت إضافتها من فجوة في طلب مرفوض.'}
          )
        `;
        orderIndex += 1;
        existing.push({ title_en: `Close gap: ${label}`, description_en: label });
      }

      await computeStudentDimensions(studentId);
    }

    // Remove the rejected application — it no longer appears in either portal.
    await sql`DELETE FROM applications WHERE id = ${id}`;

    return NextResponse.json({ success: true, deleted: true });
  } catch (error: any) {
    console.error('POST /api/corporates/applications/[id]/reject error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
