/**
 * /api/corporates/jobs
 *
 * POST — create a job posting (Section 6.3 / 7). Validates with zod, computes
 *        dimension_requirements via lib/job-vector, inserts with sql.json() for
 *        every JSONB column. If hiring_outcome_flag is true, fans out a Tier-1
 *        roadmap_node to every matching student (live market vector update).
 * GET  — list this corporate's jobs with applicant counts.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { computeJobDimensionRequirements } from '@/lib/job-vector';
import { computePoints, getDimensionWeight } from '@/lib/points';
import { asArray } from '@/lib/job-helpers';

const SkillSchema = z.object({
  skill: z.string().min(1),
  importance: z.number().int().min(1).max(5),
});

const BodySchema = z.object({
  title: z.string().min(1),
  posting_type: z.enum(['full_time', 'internship', 'coop', 'training']),
  role_category: z.string().min(1),
  description: z.string().min(1),
  description_ar: z.string().min(1),
  location_region: z.string().min(1),
  location_city: z.string().min(1),
  salary_min: z.number().int().min(0),
  salary_max: z.number().int().min(0),
  required_skills: z.array(SkillSchema).default([]),
  required_certs: z.array(z.string().min(1)).default([]),
  required_experience_years: z.number().int().min(0).max(40),
  required_education_level: z.enum(['high_school', 'bachelor', 'master', 'phd']),
  hiring_outcome_flag: z.boolean().default(false),
  deadline: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'corporate') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const corporateId = session.userId;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const b = parsed.data;
    if (b.salary_max < b.salary_min) {
      return NextResponse.json({ error: 'salary_max must be >= salary_min' }, { status: 400 });
    }

    const [corp] = await sql`SELECT sector FROM corporates WHERE user_id = ${corporateId}`;
    if (!corp) return NextResponse.json({ error: 'Corporate profile not found' }, { status: 404 });
    // Cluster auto-set from the corporate's sector ('other' has no job cluster).
    const cluster = ['medicine', 'engineering', 'tech'].includes(corp.sector) ? corp.sector : 'tech';

    const dimensionRequirements = computeJobDimensionRequirements({
      required_skills: b.required_skills,
      required_certs: b.required_certs,
      required_experience_years: b.required_experience_years,
      required_education_level: b.required_education_level,
    });

    const [job] = await sql`
      INSERT INTO jobs (
        corporate_id, title, posting_type, role_category, cluster, description, description_ar,
        location_region, location_city, salary_min, salary_max,
        required_skills, required_certs, required_experience_years, required_education_level,
        dimension_requirements, hiring_outcome_flag, deadline, status, is_seeded
      ) VALUES (
        ${corporateId}, ${b.title}, ${b.posting_type}, ${b.role_category}, ${cluster}, ${b.description}, ${b.description_ar},
        ${b.location_region}, ${b.location_city}, ${b.salary_min}, ${b.salary_max},
        ${sql.json(b.required_skills)}, ${sql.json(b.required_certs)},
        ${b.required_experience_years}, ${b.required_education_level},
        ${sql.json(dimensionRequirements as unknown as Record<string, number>)}, ${b.hiring_outcome_flag}, ${b.deadline}, 'open', false
      )
      RETURNING *
    `;

    let tier1FanOut = 0;
    if (b.hiring_outcome_flag) {
      // Students in this job's cluster whose opportunity_types intersect the posting_type.
      const students = await sql`
        SELECT user_id, opportunity_types FROM students WHERE cluster = ${cluster}
      `;
      for (const st of students) {
        const opps = asArray<string>(st.opportunity_types);
        if (!opps.includes(b.posting_type)) continue;

        const dimensionTarget = 'portfolio';
        const difficulty = 3;
        const hours = 20;
        const tier = 1;
        const points = computePoints(difficulty, hours, getDimensionWeight(cluster, dimensionTarget), tier);
        const [{ max_idx }] = await sql`
          SELECT COALESCE(MAX(order_index), -1) AS max_idx FROM roadmap_nodes WHERE student_id = ${st.user_id}
        `;
        await sql`
          INSERT INTO roadmap_nodes (
            student_id, title_en, title_ar, description_en, description_ar,
            dimension_target, difficulty, hours, points, tier, status,
            order_index, resources, why_this_tier
          ) VALUES (
            ${st.user_id},
            ${`Hiring opportunity: ${b.title}`},
            ${`فرصة توظيف: ${b.title}`},
            ${`${b.title} is an open hiring-outcome posting matching your cluster and goals. Sharpen your profile for this role — it can lead directly to employment.`},
            ${`${b.title} وظيفة مفتوحة بنتيجة توظيف تطابق مجالك وأهدافك. عزّز ملفك لهذا الدور — قد يقودك مباشرةً إلى التوظيف.`},
            ${dimensionTarget}, ${difficulty}, ${hours}, ${points}, ${tier}, 'unlocked',
            ${(max_idx as number) + 1}, ${sql.json([])},
            ${'EN: Tier 1 — direct hiring-outcome posting in your cluster. ||| AR: المستوى 1 — وظيفة بنتيجة توظيف مباشرة في مجالك.'}
          )
        `;
        tier1FanOut++;
      }
    }

    return NextResponse.json({ success: true, id: job.id, tier1FanOut });
  } catch (error: any) {
    console.error('POST /api/corporates/jobs error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'corporate') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const jobs = await sql`
      SELECT j.*, COUNT(a.id)::int AS applicant_count
      FROM jobs j
      LEFT JOIN applications a ON a.job_id = j.id
      WHERE j.corporate_id = ${session.userId}
      GROUP BY j.id
      ORDER BY j.created_at DESC
    `;
    return NextResponse.json({ jobs });
  } catch (error: any) {
    console.error('GET /api/corporates/jobs error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
