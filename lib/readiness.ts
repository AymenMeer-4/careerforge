import sql from './db';
import clusterKeywords from '../data/cluster-keywords.json';

const CLUSTER_WEIGHTS: Record<string, Record<string, number>> = {
  medicine: {
    academic: 25, credentialing: 25, practical: 20, portfolio: 8, domain: 10, prof_dev: 5, soft_skills: 7
  },
  engineering: {
    academic: 20, credentialing: 18, practical: 15, portfolio: 22, domain: 12, prof_dev: 5, soft_skills: 8
  },
  tech: {
    academic: 15, credentialing: 15, practical: 15, portfolio: 30, domain: 15, prof_dev: 5, soft_skills: 5
  },
  unsupported: {
    academic: 15, credentialing: 15, practical: 15, portfolio: 15, domain: 15, prof_dev: 15, soft_skills: 10
  }
};

const TIER_1_UNIS = ['ksu', 'kfupm', 'kaust', 'kau', 'iau', 'pnu', 'ksau-hs', 'kfu', 'kku'];

export async function computeStudentDimensions(studentId: string) {
  // 1. Fetch student base data
  const [student] = await sql`SELECT * FROM students WHERE user_id = ${studentId}`;
  if (!student) throw new Error('Student not found');

  const cluster = student.cluster as keyof typeof CLUSTER_WEIGHTS;
  const weights = CLUSTER_WEIGHTS[cluster] || CLUSTER_WEIGHTS.unsupported;

  // --- dim_academic ---
  const gpaNormalized = (Number(student.gpa_value) / Number(student.gpa_scale)) * 100;
  let yearProgress = 100;
  if (student.year_of_study !== 'graduate') {
    yearProgress = (Number(student.year_of_study) / 6) * 100;
  }
  const uniKey = student.university.toLowerCase();
  let uniTier = 50;
  if (TIER_1_UNIS.includes(uniKey)) {
    uniTier = 100;
  } else {
    uniTier = 70;
  }
  const dim_academic = Math.min(100, (gpaNormalized * 0.6) + (yearProgress * 0.3) + (uniTier * 0.1));

  // --- dim_credentialing ---
  const [{ count: verifiedCreds }] = await sql`
    SELECT COUNT(*)::int as count FROM student_experiences 
    WHERE student_id = ${studentId} AND verification_status = 'verified' AND type IN ('certificate', 'training', 'internship')
  `;
  const [{ count: pendingCreds }] = await sql`
    SELECT COUNT(*)::int as count FROM student_experiences 
    WHERE student_id = ${studentId} AND verification_status = 'pending' AND type IN ('certificate', 'training', 'internship')
  `;
  const [{ count: verifiedHackathon }] = await sql`
    SELECT COUNT(*)::int as count FROM student_experiences 
    WHERE student_id = ${studentId} AND verification_status = 'verified' AND type IN ('hackathon', 'event')
  `;
  const [{ count: pendingHackathon }] = await sql`
    SELECT COUNT(*)::int as count FROM student_experiences 
    WHERE student_id = ${studentId} AND verification_status = 'pending' AND type IN ('hackathon', 'event')
  `;
  const [{ count: unverifiedHackathon }] = await sql`
    SELECT COUNT(*)::int as count FROM student_experiences 
    WHERE student_id = ${studentId} AND verification_status = 'unverified' AND type IN ('hackathon', 'event')
  `;
  const dim_credentialing = Math.min(100,
    (verifiedCreds * 20) + (pendingCreds * 5) +
    (verifiedHackathon * 8) + (pendingHackathon * 5) + (unverifiedHackathon * 3)
  );

  // --- dim_practical ---
  const [{ count: practicalExp }] = await sql`
    SELECT COUNT(*)::int as count FROM student_experiences 
    WHERE student_id = ${studentId} AND type IN ('internship', 'hackathon', 'event')
  `;
  const dim_practical = Math.min(100, practicalExp * 15);

  // --- dim_portfolio ---
  const interests = student.interests || [];
  const [{ count: portfolioNodes }] = await sql`
    SELECT COUNT(*)::int as count FROM roadmap_nodes 
    WHERE student_id = ${studentId} AND status = 'completed' AND dimension_target = 'portfolio'
  `;
  const dim_portfolio = Math.min(100, (interests.length + portfolioNodes) * 10);

  // --- dim_prof_dev ---
  const [{ count: profDevExp }] = await sql`
    SELECT COUNT(*)::int as count FROM student_experiences 
    WHERE student_id = ${studentId} AND type IN ('event', 'hackathon')
  `;
  const dim_prof_dev = Math.min(100, profDevExp * 20);

  // --- dim_soft_skills ---
  const [{ avg: avgSoftSkills }] = await sql`
    SELECT COALESCE(AVG(total_score), 0)::float as avg FROM mock_interview_sessions WHERE student_id = ${studentId}
  `;
  const dim_soft_skills = Math.min(100, avgSoftSkills);

  // --- dim_domain ---
  // 1. Courses contribution
  const courses = await sql`SELECT course_name FROM student_courses WHERE student_id = ${studentId}`;
  let matchingCourses = 0;
  const keywordsList = (clusterKeywords as Record<string, string[]>)[cluster] || [];
  for (const c of courses) {
    const courseName = c.course_name.toLowerCase();
    if (keywordsList.some(kw => courseName.includes(kw.toLowerCase()))) {
      matchingCourses++;
    }
  }
  const coursesContrib = Math.min(50, matchingCourses * 5);

  // 2. Experiences contribution
  const [{ count: domainExpCount }] = await sql`
    SELECT COUNT(*)::int as count FROM student_experiences 
    WHERE student_id = ${studentId} AND type IN ('certificate', 'training')
  `;
  const expContrib = Math.min(20, domainExpCount * 4);

  // 3. Skills contribution (market-aware AND validation-aware — see Section 8.1)
  const skills = await sql`
    SELECT skill_key, proficiency_score, proficiency_level, validation_status
    FROM student_skills WHERE student_id = ${studentId}
  `;
  let skillsContrib = 0;
  for (const skill of skills) {
    // base points from the student's chosen level: Low=3, Mid=6, High=9
    const base = skill.proficiency_score / 10;

    // market_demand_count = open jobs in the student's cluster that require this skill_key
    const [{ count: marketDemandCount }] = await sql`
      SELECT COUNT(*)::int as count FROM jobs
      WHERE cluster = ${cluster} AND status = 'open'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(required_skills) as elem
        WHERE elem->>'skill' = ${skill.skill_key}
      )
    `;

    // market_multiplier: 1.0 → 2.0, saturates at 5+ jobs. This makes the
    // readiness number market-aware — skills employers want are worth more.
    const marketMultiplier = 1.0 + Math.min(1.0, marketDemandCount / 5);

    // validation_multiplier: every skill now goes through the 3-question check,
    // which decides the level. A skill whose level was confirmed by the answers
    // ('validated') keeps full credit (1.0). A skill saved without a completed
    // check ('skipped' or 'failed') is an unverified claim and is penalised to
    // 0.25 — regardless of level. The level itself drives the base points above.
    let validationMultiplier = 1.0;
    if (skill.validation_status === 'skipped' || skill.validation_status === 'failed') {
      validationMultiplier = 0.25;
    }

    // per_skill = base × market_multiplier × validation_multiplier, capped at 20
    const perSkill = Math.min(20, base * marketMultiplier * validationMultiplier);
    skillsContrib += perSkill;
  }
  const dim_domain = Math.min(100, coursesContrib + expContrib + skillsContrib);

  // --- General Readiness ---
  const general_readiness = (
    (dim_academic * weights.academic) +
    (dim_credentialing * weights.credentialing) +
    (dim_practical * weights.practical) +
    (dim_portfolio * weights.portfolio) +
    (dim_domain * weights.domain) +
    (dim_prof_dev * weights.prof_dev) +
    (dim_soft_skills * weights.soft_skills)
  ) / 100;

  // Persist to database
  const result = {
    student_id: studentId,
    dim_academic: Number(dim_academic.toFixed(2)),
    dim_credentialing: Number(dim_credentialing.toFixed(2)),
    dim_practical: Number(dim_practical.toFixed(2)),
    dim_portfolio: Number(dim_portfolio.toFixed(2)),
    dim_domain: Number(dim_domain.toFixed(2)),
    dim_prof_dev: Number(dim_prof_dev.toFixed(2)),
    dim_soft_skills: Number(dim_soft_skills.toFixed(2)),
    general_readiness: Number(general_readiness.toFixed(2))
  };

  // UPSERT: Insert if new, update if exists
  await sql`
    INSERT INTO student_dimensions (
      student_id, dim_academic, dim_credentialing, dim_practical, 
      dim_portfolio, dim_domain, dim_prof_dev, dim_soft_skills, general_readiness, last_computed_at
    ) VALUES (
      ${result.student_id}, ${result.dim_academic}, ${result.dim_credentialing}, 
      ${result.dim_practical}, ${result.dim_portfolio}, ${result.dim_domain}, 
      ${result.dim_prof_dev}, ${result.dim_soft_skills}, ${result.general_readiness}, NOW()
    )
    ON CONFLICT (student_id) DO UPDATE SET
      dim_academic = EXCLUDED.dim_academic,
      dim_credentialing = EXCLUDED.dim_credentialing,
      dim_practical = EXCLUDED.dim_practical,
      dim_portfolio = EXCLUDED.dim_portfolio,
      dim_domain = EXCLUDED.dim_domain,
      dim_prof_dev = EXCLUDED.dim_prof_dev,
      dim_soft_skills = EXCLUDED.dim_soft_skills,
      general_readiness = EXCLUDED.general_readiness,
      last_computed_at = NOW()
  `;

  return result;
}