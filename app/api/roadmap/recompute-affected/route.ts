/**
 * POST /api/roadmap/recompute-affected
 *
 * Body: { gap_tags: string[] } — skill keys taken from a rejected application.
 * For each gap tag that has no matching roadmap_node yet, creates a tier-3
 * practice node targeting the relevant dimension (default 'domain'), then
 * recomputes readiness. Returns the created nodes.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { computeStudentDimensions } from '@/lib/readiness';
import { computePoints, getDimensionWeight } from '@/lib/points';

const BodySchema = z.object({
  gap_tags: z.array(z.string().min(1)).min(1),
});

function titleize(tag: string): string {
  return tag
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const studentId = session.userId;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const gapTags = [...new Set(parsed.data.gap_tags)];

    const [student] = await sql`SELECT cluster FROM students WHERE user_id = ${studentId}`;
    const cluster: string = student?.cluster ?? 'tech';

    const existing = await sql`
      SELECT title_en, description_en FROM roadmap_nodes WHERE student_id = ${studentId}
    `;

    const [{ max_idx }] = await sql`
      SELECT COALESCE(MAX(order_index), -1) AS max_idx FROM roadmap_nodes WHERE student_id = ${studentId}
    `;
    let orderIndex = (max_idx as number) + 1;

    const dimensionTarget = 'domain';
    const created: any[] = [];

    for (const tag of gapTags) {
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

      const [node] = await sql`
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
          ${dimensionTarget},
          ${difficulty},
          ${hours},
          ${points},
          ${tier},
          'unlocked',
          ${orderIndex},
          ${JSON.stringify([])},
          ${'EN: Added from a rejected application gap. ||| AR: تمت إضافتها من فجوة في طلب مرفوض.'}
        )
        RETURNING *
      `;
      created.push(node);
      orderIndex += 1;
      // keep the in-memory list current so duplicate tags within this request dedupe
      existing.push({ title_en: node.title_en, description_en: node.description_en });
    }

    await computeStudentDimensions(studentId);

    return NextResponse.json({ created, count: created.length });
  } catch (error: any) {
    console.error('POST /api/roadmap/recompute-affected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
