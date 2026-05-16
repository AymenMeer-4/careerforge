/**
 * POST /api/roadmap/generate
 *
 * Generates a personalized roadmap for the current student using Claude (Section 9.1).
 * - Validates profile has target_role, opportunity_types, hours_per_week.
 * - Computes gap vector (student dims vs. average required dims of matching jobs).
 * - Calls Claude with the roadmap prompt.
 * - Parses + validates response with Zod; retries once on failure.
 * - Computes points for each node; replaces existing nodes; returns saved nodes.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { callClaude } from '@/lib/claude';
import { buildRoadmapPrompt } from '@/lib/prompts/roadmap';
import { computeRoleMatch, computeGapVector, type DimVector } from '@/lib/role-match';
import { computePoints, getDimensionWeight } from '@/lib/points';

// ── Zod schema for a single node returned by Claude ──────────────────────────

const ResourceSchema = z.object({
  title: z.string(),
  // url is intentionally ignored on render — the UI rebuilds a provider search
  // URL from `provider` + `title` so no unvetted AI URL is ever surfaced.
  url: z.string().optional(),
  provider: z.string(),
  type: z.string().optional().default('course'),
  hours: z.number().optional().default(0),
  language: z.string().optional().default('en'),
  cost: z.string().optional().default('free'),
});

const NodeSchema = z.object({
  title_en: z.string().min(1),
  title_ar: z.string().min(1),
  description_en: z.string().min(1),
  description_ar: z.string().min(1),
  dimension_target: z.enum(['academic', 'credentialing', 'practical', 'portfolio', 'domain', 'prof_dev', 'soft_skills']),
  difficulty: z.number().int().min(1).max(5),
  hours: z.number().int().min(1),
  tier: z.number().int().min(1).max(5),
  resources: z.array(ResourceSchema).min(1).max(5),
  why_this_tier_en: z.string().optional().default(''),
  why_this_tier_ar: z.string().optional().default(''),
});

const NodesArraySchema = z.array(NodeSchema).min(1).max(20);

// ── Helper: parse Claude's text as JSON node array ────────────────────────────
function parseClaudeNodes(text: string) {
  // Strip markdown code fences if Claude adds them despite instructions
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  const raw = JSON.parse(cleaned);
  return NodesArraySchema.parse(raw);
}

export async function POST() {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const studentId = session.userId;

    // ── Load student + profile ────────────────────────────────────────────────
    const [studentRow] = await sql`
      SELECT s.*, u.name, u.email
      FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE s.user_id = ${studentId}
    `;
    if (!studentRow) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    }

    // Validate minimum required fields
    if (!studentRow.target_role) {
      return NextResponse.json(
        { error: 'Target role is required to generate a roadmap. Please complete your profile.' },
        { status: 400 },
      );
    }
    if (!studentRow.opportunity_types || studentRow.opportunity_types.length === 0) {
      return NextResponse.json(
        { error: 'Opportunity types are required. Please complete your profile.' },
        { status: 400 },
      );
    }
    if (!studentRow.hours_per_week) {
      return NextResponse.json(
        { error: 'Available hours per week is required. Please complete your profile.' },
        { status: 400 },
      );
    }

    // ── Load student dimensions ───────────────────────────────────────────────
    const [dimsRow] = await sql`
      SELECT * FROM student_dimensions WHERE student_id = ${studentId}
    `;
    const studentDims: DimVector = dimsRow
      ? {
        dim_academic: Number(dimsRow.dim_academic),
        dim_credentialing: Number(dimsRow.dim_credentialing),
        dim_practical: Number(dimsRow.dim_practical),
        dim_portfolio: Number(dimsRow.dim_portfolio),
        dim_domain: Number(dimsRow.dim_domain),
        dim_prof_dev: Number(dimsRow.dim_prof_dev),
        dim_soft_skills: Number(dimsRow.dim_soft_skills),
      }
      : {
        dim_academic: 0, dim_credentialing: 0, dim_practical: 0,
        dim_portfolio: 0, dim_domain: 0, dim_prof_dev: 0, dim_soft_skills: 0,
      };

    // ── Compute gap vector ────────────────────────────────────────────────────
    // Average the dimension_requirements of all open jobs matching the student's target role
    const matchingJobs = await sql`
      SELECT dimension_requirements
      FROM jobs
      WHERE role_category = ${studentRow.target_role}
        AND status = 'open'
        AND cluster = ${studentRow.cluster}
    `;

    let avgRequired: Partial<DimVector> = {};
    if (matchingJobs.length > 0) {
      const sums: Record<string, number> = {};
      for (const job of matchingJobs) {
        const req = job.dimension_requirements as Record<string, number>;
        for (const [k, v] of Object.entries(req)) {
          sums[k] = (sums[k] ?? 0) + Number(v);
        }
      }
      for (const [k, v] of Object.entries(sums)) {
        (avgRequired as any)[k] = v / matchingJobs.length;
      }
    } else {
      // No jobs posted yet — use sensible defaults per cluster
      const defaults: Record<string, Partial<DimVector>> = {
        medicine: { dim_academic: 80, dim_credentialing: 70, dim_practical: 60, dim_portfolio: 40, dim_domain: 60, dim_prof_dev: 50, dim_soft_skills: 60 },
        engineering: { dim_academic: 70, dim_credentialing: 60, dim_practical: 60, dim_portfolio: 65, dim_domain: 55, dim_prof_dev: 50, dim_soft_skills: 55 },
        tech: { dim_academic: 60, dim_credentialing: 55, dim_practical: 60, dim_portfolio: 70, dim_domain: 65, dim_prof_dev: 50, dim_soft_skills: 50 },
      };
      avgRequired = defaults[studentRow.cluster] ?? defaults.tech;
    }

    const gapVector = computeGapVector(studentDims, avgRequired);
    // Convert so positive = student is BELOW requirement (per prompt template)
    const gapForPrompt: Record<string, number> = {};
    for (const [k, v] of Object.entries(gapVector)) {
      gapForPrompt[k] = -v; // flip: negative gap means student is behind
    }

    // ── Build prompt ──────────────────────────────────────────────────────────
    const { system, userMessage } = buildRoadmapPrompt({
      name: studentRow.name,
      cluster: studentRow.cluster,
      specialty: studentRow.specialty,
      year_of_study: studentRow.year_of_study,
      gpa_value: Number(studentRow.gpa_value),
      gpa_scale: studentRow.gpa_scale,
      university: studentRow.university,
      opportunity_types: studentRow.opportunity_types as string[],
      hours_per_week: Number(studentRow.hours_per_week),
      target_role: studentRow.target_role,
      dims: studentDims,
      targetRoleName: String(studentRow.target_role ?? '').replace(/_/g, ' '),
      gapVector: gapForPrompt,
    });

    // ── Call Claude (with one retry on JSON parse failure) ────────────────────
    let parsedNodes: z.infer<typeof NodeSchema>[];

    const firstResponse = await callClaude(
      system,
      [{ role: 'user', content: userMessage }],
      { max_tokens: 8000, temperature: 0 },
    );

    if (!firstResponse.ok) {
      return NextResponse.json(
        { error: `Claude API error: ${firstResponse.error}` },
        { status: 500 },
      );
    }

    try {
      parsedNodes = parseClaudeNodes(firstResponse.text);
    } catch (parseErr) {
      // Retry once with a clear malformed-JSON message
      const retryResponse = await callClaude(
        system,
        [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: firstResponse.text },
          {
            role: 'user',
            content:
              'The previous response was malformed JSON. Please return ONLY a valid JSON array of node objects, with no markdown, no prose, no code fences. Start your response with [ and end with ].',
          },
        ],
        { max_tokens: 8000, temperature: 0 },
      );

      if (!retryResponse.ok) {
        return NextResponse.json(
          { error: `Claude API error on retry: ${retryResponse.error}` },
          { status: 500 },
        );
      }

      try {
        parsedNodes = parseClaudeNodes(retryResponse.text);
      } catch (retryParseErr) {
        // Per spec: no fake fallback — return real 500
        console.error('Roadmap generation: Claude returned invalid JSON twice.', {
          firstText: firstResponse.text.slice(0, 500),
          retryText: retryResponse.text.slice(0, 500),
          parseErr: String(retryParseErr),
        });
        return NextResponse.json(
          {
            error:
              'Roadmap generation failed: Claude returned invalid JSON twice. Please try again in a moment.',
          },
          { status: 500 },
        );
      }
    }

    // ── Compute points and persist ────────────────────────────────────────────
    // Delete existing roadmap nodes for this student
    await sql`DELETE FROM roadmap_nodes WHERE student_id = ${studentId}`;

    // Sort by tier, then by order within Claude's response
    const sorted = [...parsedNodes].sort((a, b) => a.tier - b.tier);

    const savedNodes = [];
    for (let i = 0; i < sorted.length; i++) {
      const node = sorted[i];
      const dimWeight = getDimensionWeight(studentRow.cluster, node.dimension_target);
      const points = computePoints(node.difficulty, node.hours, dimWeight, node.tier);

      const [saved] = await sql`
        INSERT INTO roadmap_nodes (
          student_id, title_en, title_ar, description_en, description_ar,
          dimension_target, difficulty, hours, points, tier, status,
          order_index, resources, why_this_tier
        ) VALUES (
          ${studentId},
          ${node.title_en},
          ${node.title_ar},
          ${node.description_en},
          ${node.description_ar},
          ${node.dimension_target},
          ${node.difficulty},
          ${node.hours},
          ${points},
          ${node.tier},
          'unlocked',
          ${i},
          ${JSON.stringify(node.resources)},
          ${`EN: ${node.why_this_tier_en || ''} ||| AR: ${node.why_this_tier_ar || ''}`}
        )
        RETURNING *
      `;
      savedNodes.push(saved);
    }

    return NextResponse.json({ nodes: savedNodes, count: savedNodes.length });
  } catch (error: any) {
    console.error('POST /api/roadmap/generate error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
