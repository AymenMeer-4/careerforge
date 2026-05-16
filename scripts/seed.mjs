/**
 * scripts/seed.mjs — Build Spec §11 (Seed Data) + Prompt 10 step 1.
 *
 * Node-runnable seed script (mirrors the migrate.mjs pattern — a `.ts` file
 * cannot be executed without a TS loader, so the project standard is `.mjs`).
 *
 * What it does:
 *   1. Removes only previous demo data: deleting the two demo users cascades
 *      (ON DELETE CASCADE) to every row they own. Real accounts are untouched,
 *      and re-running the seed is idempotent.
 *   2. Inserts 1 demo student (fully onboarded, Tech / ml_engineer) with a
 *      transcript of 8 courses, 2 experiences (1 verified cert, 1 hackathon),
 *      8 pre-approved skills (3 with explicit validation states), and 1 mock
 *      interview session.
 *   3. Inserts 1 demo corporate ("Tuwaiq Academy", verified).
 *   4. Inserts 15 Tech-cluster seeded jobs from real Saudi employers, 3 flagged
 *      hiring_outcome_flag = true.
 *   5. Best-effort: logs in as the demo student against a running dev server
 *      and calls /api/readiness/recompute + /api/roadmap/generate so the demo
 *      student has real cached dimensions and a Claude-generated roadmap.
 *
 * Lookup tables (13 regions, ~30 cities, 10 universities, ~30 skill-ontology
 * slugs, 3 mock-interview scenarios per cluster, role catalog) are file-based
 * in data/*.json and lib/corporate-options.ts — they are not DB tables, so the
 * seed does not insert them; they ship with the repo.
 *
 * Run:
 *   1. (once) node --env-file=.env.local scripts/migrate.mjs
 *   2. npm run dev              # in another terminal — needed for step 5
 *   3. node --env-file=.env.local scripts/seed.mjs
 *
 * Env knobs:
 *   DATABASE_URL    — Neon connection string (required).
 *   SEED_BASE_URL   — dev server origin for step 5 (default http://localhost:3000).
 */

import postgres from 'postgres';
import bcrypt from 'bcryptjs';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1, connect_timeout: 60 });

const DEMO_STUDENT_EMAIL = 'demo.student@careerforge.sa';
const DEMO_STUDENT_PASSWORD = 'DemoPass123';
const DEMO_CORP_EMAIL = 'demo.corp@careerforge.sa';
const DEMO_CORP_PASSWORD = 'CorpPass123';
const BASE_URL = process.env.SEED_BASE_URL || 'http://localhost:3000';

// ── Seeded jobs (§11.3) — 15 Tech-cluster jobs, real Saudi employers ──────────
const EDU_SCORE = { high_school: 1, bachelor: 3, master: 4, phd: 5 };

function jobVector({ skills, certs, years, education }) {
  const cap = (n) => Math.min(100, Math.round(n));
  return {
    dim_academic: cap(50 + (EDU_SCORE[education] ?? 3) * 10 + years * 5),
    dim_credentialing: cap(certs.length * 20),
    dim_practical: cap(years * 15),
    dim_portfolio: cap(skills.filter((s) => s.importance >= 3).length * 10),
    dim_domain: cap(skills.length * 5),
    dim_prof_dev: 40,
    dim_soft_skills: 60,
  };
}

const S = (skill, importance) => ({ skill, importance });

// hof: hiring_outcome_flag — exactly 3 jobs carry it (one per role family).
const JOBS = [
  // ── ML Engineer ──
  { title: 'Machine Learning Engineer', company: 'Aramco Digital', role: 'ml_engineer', region: 'Eastern Province', city: 'Dhahran',
    skills: [S('python', 5), S('machine-learning', 5), S('deep-learning', 4), S('mlops', 4), S('statistics', 3), S('docker', 3)],
    certs: ['aws-machine-learning'], years: 2, education: 'bachelor', salary: [14000, 20000], pt: 'full_time', hof: true },
  { title: 'ML Engineer — Recommendations', company: 'STC', role: 'ml_engineer', region: 'Riyadh', city: 'Riyadh',
    skills: [S('python', 5), S('machine-learning', 5), S('tensorflow', 4), S('data-engineering', 3)],
    certs: [], years: 1, education: 'bachelor', salary: [12000, 17000], pt: 'full_time', hof: false },
  { title: 'AI/ML Engineer', company: 'SDAIA', role: 'ml_engineer', region: 'Riyadh', city: 'Riyadh',
    skills: [S('python', 5), S('deep-learning', 5), S('nlp', 5), S('tensorflow', 4), S('mlops', 4), S('statistics', 4), S('cloud-computing', 3)],
    certs: ['tensorflow-developer', 'aws-machine-learning'], years: 3, education: 'master', salary: [18000, 25000], pt: 'full_time', hof: false },
  { title: 'ML Engineer Intern', company: 'Tabby', role: 'ml_engineer', region: 'Riyadh', city: 'Riyadh',
    skills: [S('python', 4), S('machine-learning', 3), S('sql', 2)],
    certs: [], years: 0, education: 'bachelor', salary: [4000, 6000], pt: 'internship', hof: false },
  { title: 'Applied ML Engineer', company: 'Mozn', role: 'ml_engineer', region: 'Riyadh', city: 'Riyadh',
    skills: [S('python', 5), S('machine-learning', 4), S('mlops', 4), S('docker', 3), S('cloud-computing', 3)],
    certs: ['aws-machine-learning'], years: 2, education: 'bachelor', salary: [13000, 19000], pt: 'full_time', hof: false },

  // ── Data Scientist ──
  { title: 'Data Scientist', company: 'STC', role: 'data_scientist', region: 'Riyadh', city: 'Riyadh',
    skills: [S('python', 5), S('statistics', 5), S('sql', 4), S('data-visualization', 4), S('machine-learning', 3)],
    certs: [], years: 2, education: 'bachelor', salary: [13000, 18000], pt: 'full_time', hof: true },
  { title: 'Senior Data Scientist', company: 'SDAIA', role: 'data_scientist', region: 'Riyadh', city: 'Riyadh',
    skills: [S('python', 5), S('statistics', 5), S('machine-learning', 5), S('sql', 4), S('data-visualization', 4), S('deep-learning', 3)],
    certs: ['aws-machine-learning'], years: 4, education: 'master', salary: [20000, 28000], pt: 'full_time', hof: false },
  { title: 'Data Scientist — Risk', company: 'Tamara', role: 'data_scientist', region: 'Riyadh', city: 'Riyadh',
    skills: [S('python', 4), S('statistics', 5), S('sql', 5), S('machine-learning', 3)],
    certs: [], years: 2, education: 'bachelor', salary: [12000, 17000], pt: 'full_time', hof: false },
  { title: 'Data Science Co-op', company: 'Hala', role: 'data_scientist', region: 'Makkah', city: 'Jeddah',
    skills: [S('python', 3), S('sql', 3), S('statistics', 3), S('data-visualization', 2)],
    certs: [], years: 0, education: 'bachelor', salary: [3500, 5500], pt: 'coop', hof: false },
  { title: 'Data Scientist', company: 'Lean Business Services', role: 'data_scientist', region: 'Riyadh', city: 'Riyadh',
    skills: [S('python', 4), S('sql', 4), S('statistics', 4), S('data-visualization', 3), S('machine-learning', 3)],
    certs: [], years: 1, education: 'bachelor', salary: [11000, 16000], pt: 'full_time', hof: false },

  // ── Full-Stack Dev ──
  { title: 'Full-Stack Developer', company: 'Tabby', role: 'full_stack_dev', region: 'Riyadh', city: 'Riyadh',
    skills: [S('javascript', 5), S('react', 5), S('nodejs', 5), S('typescript', 4), S('sql', 3), S('docker', 3)],
    certs: [], years: 2, education: 'bachelor', salary: [14000, 20000], pt: 'full_time', hof: false },
  { title: 'Full-Stack Engineer', company: 'Tamara', role: 'full_stack_dev', region: 'Riyadh', city: 'Riyadh',
    skills: [S('javascript', 5), S('react', 4), S('nodejs', 4), S('typescript', 4), S('devops', 3)],
    certs: ['aws-developer'], years: 3, education: 'bachelor', salary: [16000, 23000], pt: 'full_time', hof: false },
  { title: 'Frontend-Heavy Full-Stack Dev', company: 'Mozn', role: 'full_stack_dev', region: 'Riyadh', city: 'Riyadh',
    skills: [S('javascript', 5), S('react', 5), S('typescript', 5), S('nodejs', 3)],
    certs: [], years: 1, education: 'bachelor', salary: [12000, 17000], pt: 'full_time', hof: false },
  { title: 'Full-Stack Developer Trainee', company: 'Salla', role: 'full_stack_dev', region: 'Makkah', city: 'Jeddah',
    skills: [S('javascript', 4), S('react', 3), S('nodejs', 3)],
    certs: [], years: 0, education: 'bachelor', salary: [4000, 6000], pt: 'training', hof: false },
  { title: 'Senior Full-Stack Engineer', company: 'Foodics', role: 'full_stack_dev', region: 'Riyadh', city: 'Riyadh',
    skills: [S('javascript', 5), S('react', 5), S('nodejs', 5), S('typescript', 5), S('devops', 4), S('docker', 4), S('cloud-computing', 3)],
    certs: ['aws-developer', 'aws-solutions-architect'], years: 5, education: 'bachelor', salary: [22000, 30000], pt: 'full_time', hof: true },
];

// ── Demo student transcript — 8 Tech courses (Vision-extracted) ───────────────
const COURSES = [
  { name: 'Introduction to Computer Science', code: 'CS101', credits: 3, grade: 'A', semester: '2022 Fall' },
  { name: 'Data Structures and Algorithms', code: 'CS210', credits: 4, grade: 'A-', semester: '2023 Spring' },
  { name: 'Database Systems', code: 'CS340', credits: 3, grade: 'B+', semester: '2023 Fall' },
  { name: 'Software Engineering', code: 'CS361', credits: 3, grade: 'A', semester: '2023 Fall' },
  { name: 'Machine Learning', code: 'CS445', credits: 3, grade: 'A', semester: '2024 Spring' },
  { name: 'Statistics for Computing', code: 'STAT250', credits: 3, grade: 'B+', semester: '2024 Spring' },
  { name: 'Data Mining and Analytics', code: 'CS460', credits: 3, grade: 'A-', semester: '2024 Fall' },
  { name: 'Information Security', code: 'CS470', credits: 3, grade: 'B+', semester: '2024 Fall' },
];

// ── Demo student skills — 8 pre-approved rows (§5.5, §8.1) ────────────────────
const LEVEL_SCORE = { low: 30, mid: 60, high: 90 };

const PYTHON_QUESTIONS = [
  { id: 'q1', question_en: 'You have a 10M row table and a SELECT query taking 8 seconds. What is your first move?',
    question_ar: 'لديك جدول يحتوي على 10 ملايين صف واستعلام SELECT يستغرق 8 ثوانٍ. ما هي خطوتك الأولى؟' },
  { id: 'q2', question_en: 'A teammate\'s Python script works on their laptop but crashes on the server with a missing-module error. What do you check first?',
    question_ar: 'سكربت بايثون لزميلك يعمل على جهازه لكنه يتعطل على الخادم بخطأ وحدة مفقودة. ما الذي تتحقق منه أولاً؟' },
];
const PYTHON_RESPONSES = [
  { question_id: 'q1', answer: 'Run EXPLAIN ANALYZE first to see if it is a sequential scan, then add an index on the filtered column before touching anything else.' },
  { question_id: 'q2', answer: 'The virtual environment — the server is almost certainly missing a dependency that is not pinned in requirements.txt, so I would compare the installed packages.' },
];

const STATS_QUESTIONS = [
  { id: 'q1', question_en: 'Your A/B test shows a 2% lift with a p-value of 0.06. What do you tell the product manager?',
    question_ar: 'يُظهر اختبار A/B تحسناً بنسبة 2% بقيمة احتمالية 0.06. ماذا تخبر مدير المنتج؟' },
  { id: 'q2', question_en: 'A model has 95% accuracy but the business says it is useless. What is the most likely explanation?',
    question_ar: 'يحقق النموذج دقة 95% لكن العمل يقول إنه عديم الفائدة. ما هو التفسير الأرجح؟' },
];
const STATS_RESPONSES = [
  { question_id: 'q1', answer: 'The result is not statistically significant at the 0.05 threshold; I would recommend running the test longer rather than shipping on a near-miss.' },
  { question_id: 'q2', answer: 'The classes are probably imbalanced — accuracy is misleading, so I would look at precision, recall, and the confusion matrix instead.' },
];

const SKILLS = [
  {
    key: 'python', name: 'Python', level: 'high',
    description_en: 'Strong general-purpose Python: comfortable with data libraries, scripting, and writing clean, testable code for production-style work.',
    description_ar: 'إتقان قوي لبايثون للأغراض العامة: ارتياح مع مكتبات البيانات والبرمجة وكتابة كود نظيف قابل للاختبار لعمل بمستوى الإنتاج.',
    reasoning_en: 'Coursework in ML and Data Mining plus the validation answers show production-style judgment — confirmed High.',
    reasoning_ar: 'تشير مقررات تعلم الآلة والتنقيب في البيانات إضافةً إلى إجابات التحقق إلى حكم بمستوى الإنتاج — تم تأكيد المستوى مرتفع.',
    validation_status: 'validated', validation_score: 8.7,
    validation_questions: PYTHON_QUESTIONS, validation_responses: PYTHON_RESPONSES,
    validation_notes: 'Strong production-style judgment across both scenarios — confirmed High.',
  },
  {
    key: 'sql', name: 'SQL', level: 'mid',
    description_en: 'Solid working SQL: joins, aggregations, and subqueries for everyday analysis; less exposure to query tuning at scale.',
    description_ar: 'مهارة عملية جيدة في SQL: عمليات الربط والتجميع والاستعلامات الفرعية للتحليل اليومي؛ خبرة أقل في تحسين الاستعلامات على نطاق واسع.',
    reasoning_en: 'Database Systems coursework supports a Mid level for routine analytical querying.',
    reasoning_ar: 'يدعم مقرر أنظمة قواعد البيانات مستوىً متوسطاً للاستعلامات التحليلية الاعتيادية.',
    validation_status: 'not_required',
  },
  {
    key: 'statistics', name: 'Statistics', level: 'high',
    description_en: 'Comfortable with inference, hypothesis testing, and evaluation metrics; reads experiment results critically.',
    description_ar: 'ارتياح مع الاستدلال واختبار الفرضيات ومقاييس التقييم؛ يقرأ نتائج التجارب بعين ناقدة.',
    reasoning_en: 'Statistics for Computing coursework and validation answers show sound reasoning about significance and metrics — confirmed High.',
    reasoning_ar: 'يُظهر مقرر الإحصاء للحوسبة وإجابات التحقق استدلالاً سليماً حول الدلالة والمقاييس — تم تأكيد المستوى مرتفع.',
    validation_status: 'validated', validation_score: 7.4,
    validation_questions: STATS_QUESTIONS, validation_responses: STATS_RESPONSES,
    validation_notes: 'Correctly handled significance thresholds and metric selection — confirmed High.',
  },
  {
    key: 'linear-algebra', name: 'Linear Algebra', level: 'mid',
    description_en: 'Understands vectors, matrices, and decompositions well enough to follow ML math; limited hands-on application.',
    description_ar: 'يفهم المتجهات والمصفوفات والتحليلات بما يكفي لمتابعة رياضيات تعلم الآلة؛ تطبيق عملي محدود.',
    reasoning_en: 'Foundational math from coursework supports a Mid level.',
    reasoning_ar: 'تدعم الأسس الرياضية من المقررات مستوىً متوسطاً.',
    validation_status: 'not_required',
  },
  {
    key: 'git', name: 'Git', level: 'mid',
    description_en: 'Day-to-day Git: branching, commits, and pull requests on team projects; less experience resolving complex merge conflicts.',
    description_ar: 'استخدام يومي لـ Git: التفريع والإيداعات وطلبات الدمج في مشاريع الفريق؛ خبرة أقل في حل تعارضات الدمج المعقدة.',
    reasoning_en: 'Team coursework projects support a Mid level for collaborative version control.',
    reasoning_ar: 'تدعم مشاريع المقررات الجماعية مستوىً متوسطاً للتحكم التعاوني بالإصدارات.',
    validation_status: 'not_required',
  },
  {
    key: 'data-visualization', name: 'Data Visualization', level: 'low',
    description_en: 'Early-stage: can produce basic charts with standard libraries but limited storytelling or dashboard work.',
    description_ar: 'مرحلة مبكرة: يستطيع إنتاج رسوم بيانية أساسية بمكتبات قياسية لكن مع عمل محدود في السرد أو لوحات المعلومات.',
    reasoning_en: 'Limited exposure so far supports a Low starting level.',
    reasoning_ar: 'تدعم الخبرة المحدودة حتى الآن مستوى بداية منخفضاً.',
    validation_status: 'not_required',
  },
  {
    key: 'tensorflow', name: 'TensorFlow', level: 'high',
    description_en: 'Has built and trained neural networks with TensorFlow/Keras for coursework models.',
    description_ar: 'قام ببناء وتدريب شبكات عصبية باستخدام TensorFlow/Keras لنماذج المقررات.',
    reasoning_en: 'Student selected High; the proficiency check was skipped, so this remains an unvalidated claim.',
    reasoning_ar: 'اختار الطالب المستوى مرتفع؛ تم تخطي فحص الكفاءة، لذا يبقى ادعاءً غير مُتحقق منه.',
    validation_status: 'skipped',
  },
  {
    key: 'cloud-platforms', name: 'Cloud Platforms', level: 'low',
    description_en: 'Early-stage cloud exposure: aware of core AWS services but limited hands-on deployment experience.',
    description_ar: 'خبرة سحابية مبكرة: على دراية بخدمات AWS الأساسية لكن خبرة نشر عملية محدودة.',
    reasoning_en: 'Minimal hands-on cloud work supports a Low starting level.',
    reasoning_ar: 'يدعم العمل السحابي العملي الضئيل مستوى بداية منخفضاً.',
    validation_status: 'not_required',
  },
];

async function seedDatabase() {
  console.log('→ Removing previous demo data (real accounts untouched)...');
  // Deleting the two demo users is enough: every FK into users / corporates /
  // students / jobs is ON DELETE CASCADE, so this removes their students /
  // corporates rows, all seeded jobs, and the dependent applications, roadmap
  // nodes, skills, courses, experiences, dimensions and mock sessions — and
  // nothing else. Real user accounts and their data are left fully intact.
  await sql`DELETE FROM users WHERE email IN (${DEMO_STUDENT_EMAIL}, ${DEMO_CORP_EMAIL})`;

  // ── Demo student ────────────────────────────────────────────────────────────
  console.log('→ Inserting demo student...');
  const studentHash = await bcrypt.hash(DEMO_STUDENT_PASSWORD, 10);
  const [studentUser] = await sql`
    INSERT INTO users (email, password_hash, name, phone, role, language_pref)
    VALUES (${DEMO_STUDENT_EMAIL}, ${studentHash}, ${'Layla Al-Otaibi'}, ${'+966500000001'}, 'student', 'en')
    RETURNING id
  `;
  const studentId = studentUser.id;

  await sql`
    INSERT INTO students (
      user_id, university, region, specialty, cluster, year_of_study,
      gpa_scale, gpa_value, onboarding_completed_at, city, opportunity_types,
      employment_experience, hours_per_week, interests, target_role, profile_completed_at
    ) VALUES (
      ${studentId}, 'kfupm', 'eastern', 'Computer Science', 'tech', '4',
      '4.0', 3.6, NOW(), 'Dhahran', ${sql.json(['full_time', 'internship'])},
      ${'One summer internship as a data analyst.'}, 12,
      ${sql.json(['ai', 'machine-learning', 'data-engineering'])}, ${sql.json('ml_engineer')}, NOW()
    )
  `;

  // Transcript courses (Vision-extracted)
  for (const c of COURSES) {
    await sql`
      INSERT INTO student_courses (student_id, course_name, course_code, credits, grade, semester, source)
      VALUES (${studentId}, ${c.name}, ${c.code}, ${c.credits}, ${c.grade}, ${c.semester}, 'transcript_vision')
    `;
  }

  // Experiences: 1 verified certificate + 1 unverified hackathon
  await sql`
    INSERT INTO student_experiences (
      student_id, type, title, issuer, date_completed,
      verification_status, verification_method, verification_confidence, verification_notes
    ) VALUES (
      ${studentId}, 'certificate', 'IBM Data Science Professional Certificate', 'Coursera', '2024-08-15',
      'verified', 'ai_inspection', 0.92,
      ${'Coursera certificate clearly shows "IBM Data Science Professional Certificate" issued to the student on 2024-08-15. Title and issuer match the claim.'}
    )
  `;
  await sql`
    INSERT INTO student_experiences (student_id, type, title, issuer, date_completed, verification_status)
    VALUES (
      ${studentId}, 'hackathon', 'KFUPM AI Hackathon 2024 — Top 10 Finalist', 'KFUPM', '2024-11-20', 'unverified'
    )
  `;

  // 8 pre-approved skills
  for (const sk of SKILLS) {
    const validated = sk.validation_status === 'validated';
    await sql`
      INSERT INTO student_skills (
        student_id, skill_key, skill_canonical_name, description_en, description_ar,
        proficiency_level, proficiency_score, ai_suggested_level, reasoning_en, reasoning_ar,
        iteration_count, fully_approved,
        validation_status, validation_questions, validation_responses,
        validation_score, validation_notes, validated_at
      ) VALUES (
        ${studentId}, ${sk.key}, ${sk.name}, ${sk.description_en}, ${sk.description_ar},
        ${sk.level}, ${LEVEL_SCORE[sk.level]}, ${sk.level}, ${sk.reasoning_en}, ${sk.reasoning_ar},
        0, true,
        ${sk.validation_status},
        ${sk.validation_questions ? sql.json(sk.validation_questions) : null},
        ${sk.validation_responses ? sql.json(sk.validation_responses) : null},
        ${sk.validation_score ?? null},
        ${sk.validation_notes ?? null},
        ${validated ? sql`NOW()` : null}
      )
    `;
  }

  // 1 mock interview session (§11.2 — gives dim_soft_skills a real value)
  await sql`
    INSERT INTO mock_interview_sessions (
      student_id, scenario_key, response_text,
      clarity, specificity, relevance, depth, structure, total_score,
      feedback_text, improvement_areas
    ) VALUES (
      ${studentId}, 'tech_behavioral_conflict',
      ${'During our capstone project I disagreed with a teammate on whether to use a monolith or microservices. I proposed we list our actual constraints — team size and deadline — and we agreed a monolith fit better. We shipped on time.'},
      7.5, 6.0, 8.0, 6.5, 7.0, 70.0,
      ${'A clear, well-structured answer with a concrete outcome. Strengthen it by adding more specific detail about the trade-offs you weighed and quantifying the result.'},
      ${sql.json(['specificity', 'depth'])}
    )
  `;
  console.log('  demo student seeded.');

  // ── Demo corporate ──────────────────────────────────────────────────────────
  console.log('→ Inserting demo corporate...');
  const corpHash = await bcrypt.hash(DEMO_CORP_PASSWORD, 10);
  const [corpUser] = await sql`
    INSERT INTO users (email, password_hash, name, phone, role, language_pref)
    VALUES (${DEMO_CORP_EMAIL}, ${corpHash}, ${'Tuwaiq Academy HR'}, ${'+966500000002'}, 'corporate', 'en')
    RETURNING id
  `;
  const corporateId = corpUser.id;
  await sql`
    INSERT INTO corporates (user_id, company_name, sector, cr_number, verification_status)
    VALUES (${corporateId}, 'Tuwaiq Academy', 'tech', '1010012345', 'verified')
  `;
  console.log('  demo corporate seeded.');

  // ── 15 seeded jobs ──────────────────────────────────────────────────────────
  console.log('→ Inserting 15 seeded jobs...');
  let hofCount = 0;
  for (const j of JOBS) {
    const dims = jobVector(j);
    if (j.hof) hofCount++;
    await sql`
      INSERT INTO jobs (
        corporate_id, title, posting_type, role_category, cluster, description, description_ar,
        location_region, location_city, salary_min, salary_max,
        required_skills, required_certs, required_experience_years, required_education_level,
        dimension_requirements, hiring_outcome_flag, deadline, status, is_seeded
      ) VALUES (
        ${corporateId}, ${j.title}, ${j.pt}, ${j.role}, 'tech',
        ${`${j.company} is hiring a ${j.title}. You will work with a strong team on real products serving the Saudi market. We value initiative, clear communication, and a track record of shipping. Vision 2030 is reshaping the tech sector — join us in building it.`},
        ${`تعلن ${j.company} عن حاجتها لـ${j.title}. ستعمل مع فريق قوي على منتجات حقيقية تخدم السوق السعودي. نقدّر المبادرة والتواصل الواضح وسجلّاً من الإنجاز. رؤية 2030 تعيد تشكيل قطاع التقنية — انضم إلينا في بنائه.`},
        ${j.region}, ${j.city}, ${j.salary[0]}, ${j.salary[1]},
        ${sql.json(j.skills)}, ${sql.json(j.certs)}, ${j.years}, ${j.education},
        ${sql.json(dims)}, ${j.hof}, ${'2026-09-30'}, 'open', true
      )
    `;
  }
  console.log(`  ${JOBS.length} jobs seeded (${hofCount} flagged hiring_outcome_flag).`);

  return { studentId, corporateId };
}

// ── Step 5: best-effort roadmap generation via the running dev server ─────────
function cookieFrom(res) {
  const set = res.headers.getSetCookie?.() ?? [];
  return set.map((c) => c.split(';')[0]).join('; ');
}

async function generateRoadmap() {
  console.log(`→ Generating demo student roadmap via ${BASE_URL} ...`);
  let loginRes;
  try {
    loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: DEMO_STUDENT_EMAIL, password: DEMO_STUDENT_PASSWORD }),
    });
  } catch {
    console.log('  ⚠ Dev server not reachable — skipping roadmap generation.');
    console.log('    Start `npm run dev` and re-run, or log in as the demo student and open /roadmap.');
    return;
  }
  if (!loginRes.ok) {
    console.log(`  ⚠ Login failed (${loginRes.status}) — skipping roadmap generation.`);
    return;
  }
  const cookie = cookieFrom(loginRes);

  const recompute = await fetch(`${BASE_URL}/api/readiness/recompute`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  console.log(recompute.ok ? '  readiness dimensions computed.' : `  ⚠ recompute failed (${recompute.status}).`);

  const roadmap = await fetch(`${BASE_URL}/api/roadmap/generate`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  if (roadmap.ok) {
    const body = await roadmap.json();
    console.log(`  roadmap generated — ${body.count} nodes.`);
  } else {
    const body = await roadmap.json().catch(() => ({}));
    console.log(`  ⚠ roadmap generation failed (${roadmap.status}): ${body.error ?? ''}`);
    console.log('    The demo student can still trigger it by opening /roadmap.');
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  await seedDatabase();
  await generateRoadmap();
  console.log('\n✓ Seed complete.');
  console.log(`  Student:   ${DEMO_STUDENT_EMAIL} / ${DEMO_STUDENT_PASSWORD}`);
  console.log(`  Corporate: ${DEMO_CORP_EMAIL} / ${DEMO_CORP_PASSWORD}`);
  await sql.end();
}

main().catch(async (e) => {
  console.error('Seed failed:', e);
  await sql.end().catch(() => {});
  process.exit(1);
});
