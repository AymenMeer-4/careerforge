/**
 * POST /api/roadmap/nodes
 *
 * Creates a single new roadmap node (used by mock interview "Add to roadmap"
 * and job detail "Add to my Roadmap" flows).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { computePoints, getDimensionWeight } from '@/lib/points';

const BodySchema = z.object({
  title_en:         z.string().min(1),
  title_ar:         z.string().min(1),
  description_en:   z.string().min(1),
  description_ar:   z.string().min(1),
  dimension_target: z.enum(['academic', 'credentialing', 'practical', 'portfolio', 'domain', 'prof_dev', 'soft_skills']),
  difficulty:       z.number().int().min(1).max(5).default(2),
  hours:            z.number().int().min(1).default(10),
  tier:             z.number().int().min(1).max(5).default(3),
  resources:        z.array(z.object({
    title:    z.string(),
    url:      z.string(),
    provider: z.string(),
    type:     z.string().optional().default('course'),
    hours:    z.number().optional().default(0),
    language: z.string().optional().default('en'),
    cost:     z.string().optional().default('free'),
  })).default([]),
  why_this_tier_en: z.string().optional().default(''),
  why_this_tier_ar: z.string().optional().default(''),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const data = BodySchema.parse(body);

    // Get student cluster for points calc
    const [student] = await sql`SELECT cluster FROM students WHERE user_id = ${session.userId}`;
    const cluster = student?.cluster ?? 'tech';

    // Get next order_index
    const [{ max_idx }] = await sql`
      SELECT COALESCE(MAX(order_index), -1) as max_idx FROM roadmap_nodes WHERE student_id = ${session.userId}
    `;
    const orderIndex = (max_idx as number) + 1;

    const dimWeight = getDimensionWeight(cluster, data.dimension_target);
    const points = computePoints(data.difficulty, data.hours, dimWeight, data.tier);

    const [saved] = await sql`
      INSERT INTO roadmap_nodes (
        student_id, title_en, title_ar, description_en, description_ar,
        dimension_target, difficulty, hours, points, tier, status,
        order_index, resources, why_this_tier
      ) VALUES (
        ${session.userId},
        ${data.title_en},
        ${data.title_ar},
        ${data.description_en},
        ${data.description_ar},
        ${data.dimension_target},
        ${data.difficulty},
        ${data.hours},
        ${points},
        ${data.tier},
        'unlocked',
        ${orderIndex},
        ${JSON.stringify(data.resources)},
        ${`EN: ${data.why_this_tier_en || ''} ||| AR: ${data.why_this_tier_ar || ''}`}
      )
      RETURNING *
    `;

    return NextResponse.json({ node: saved });
  } catch (error: any) {
    console.error('POST /api/roadmap/nodes error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
