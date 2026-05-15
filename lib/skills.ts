import sql from './db';
import clusterKeywords from '../data/cluster-keywords.json';

export interface CurrentSkill {
  id: string;
  skill_key: string;
  skill_canonical_name: string;
  description_en: string;
  description_ar: string;
  proficiency_level: 'low' | 'mid' | 'high';
  proficiency_score: number;
  ai_suggested_level: string | null;
  reasoning_en: string;
  reasoning_ar: string;
  iteration_count: number;
  fully_approved: boolean;
  validation_status: string;
  validation_questions: any;
  validation_responses: any;
  validation_score: number | null;
  validation_notes: string | null;
  validated_at: string | null;
  market_demand_count: number;
}

export interface DerivedSkill {
  skill_key: string;
  skill_canonical_name: string;
  source: 'course' | 'experience' | 'interest';
  source_detail: string;
}

export interface RequiredSkill {
  skill_key: string;
  avg_importance: number;
  job_count: number;
}

/**
 * Manually-entered skills (primary). Each row is joined with a live count of
 * open jobs in the student's cluster that require the same skill_key — used to
 * render the bars, the "🔥 In demand" badge, and the validation badge.
 */
export async function getCurrentSkills(studentId: string): Promise<CurrentSkill[]> {
  const [student] = await sql`SELECT cluster FROM students WHERE user_id = ${studentId}`;
  if (!student) return [];
  const cluster = student.cluster;

  const rows = await sql`
    SELECT
      ss.*,
      (
        SELECT COUNT(*)::int FROM jobs j
        WHERE j.cluster = ${cluster} AND j.status = 'open'
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(j.required_skills) AS elem
          WHERE elem->>'skill' = ss.skill_key
        )
      ) AS market_demand_count
    FROM student_skills ss
    WHERE ss.student_id = ${studentId}
    ORDER BY ss.created_at ASC
  `;

  return rows.map((r: any) => ({
    ...r,
    proficiency_score: Number(r.proficiency_score),
    validation_score: r.validation_score === null ? null : Number(r.validation_score),
    market_demand_count: Number(r.market_demand_count),
  })) as CurrentSkill[];
}

/**
 * Secondary skills inferred deterministically from the student's courses,
 * experiences, and interests — shown dimmer. No level chip, no editing.
 * Skills already added manually are excluded.
 */
export async function getDerivedSkills(studentId: string): Promise<DerivedSkill[]> {
  const [student] = await sql`SELECT cluster, interests FROM students WHERE user_id = ${studentId}`;
  if (!student) return [];

  const manual = await sql`SELECT skill_key FROM student_skills WHERE student_id = ${studentId}`;
  const manualKeys = new Set(manual.map((m: any) => m.skill_key));

  const courses = await sql`SELECT course_name FROM student_courses WHERE student_id = ${studentId}`;
  const experiences = await sql`
    SELECT title, type FROM student_experiences
    WHERE student_id = ${studentId} AND type IN ('certificate', 'training')
  `;

  const keywordsList = (clusterKeywords as Record<string, string[]>)[student.cluster] || [];
  const derived: DerivedSkill[] = [];
  const seen = new Set<string>();

  const slug = (s: string) =>
    s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  // From courses matching cluster keywords
  for (const c of courses) {
    const name = String(c.course_name);
    const matched = keywordsList.find((kw) => name.toLowerCase().includes(kw.toLowerCase()));
    if (matched) {
      const key = slug(matched);
      if (key && !manualKeys.has(key) && !seen.has(key)) {
        seen.add(key);
        derived.push({
          skill_key: key,
          skill_canonical_name: matched.charAt(0).toUpperCase() + matched.slice(1),
          source: 'course',
          source_detail: name,
        });
      }
    }
  }

  // From certificates / training
  for (const e of experiences) {
    const key = slug(String(e.title));
    if (key && !manualKeys.has(key) && !seen.has(key)) {
      seen.add(key);
      derived.push({
        skill_key: key,
        skill_canonical_name: String(e.title),
        source: 'experience',
        source_detail: `${e.type}: ${e.title}`,
      });
    }
  }

  // From interests
  const interests: string[] = Array.isArray(student.interests) ? student.interests : [];
  for (const interest of interests) {
    const key = slug(String(interest));
    if (key && !manualKeys.has(key) && !seen.has(key)) {
      seen.add(key);
      derived.push({
        skill_key: key,
        skill_canonical_name: String(interest),
        source: 'interest',
        source_detail: `Interest: ${interest}`,
      });
    }
  }

  return derived;
}

/**
 * Skills required by open jobs matching the target role, aggregated and
 * weighted by importance. Returns [{ skill_key, avg_importance, job_count }].
 */
export async function getRequiredSkills(
  targetRole: string | null,
  cluster: string,
): Promise<RequiredSkill[]> {
  if (!targetRole) return [];

  const rows = await sql`
    SELECT
      elem->>'skill' AS skill_key,
      AVG((elem->>'importance')::numeric) AS avg_importance,
      COUNT(DISTINCT j.id)::int AS job_count
    FROM jobs j,
         jsonb_array_elements(j.required_skills) AS elem
    WHERE j.status = 'open'
      AND j.role_category = ${targetRole}
      AND j.cluster = ${cluster}
    GROUP BY elem->>'skill'
    ORDER BY avg_importance DESC, job_count DESC
  `;

  return rows.map((r: any) => ({
    skill_key: r.skill_key,
    avg_importance: Number(Number(r.avg_importance).toFixed(2)),
    job_count: Number(r.job_count),
  }));
}
