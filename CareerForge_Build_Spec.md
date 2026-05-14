# CareerForge AI — Build Specification (48-Hour Hackathon Cut)

**This document is the contract.** If a feature is described here, it gets built. If it is not described here, it does not get built. The build is scoped to be completable by one solo developer using Claude in Antigravity over 48 hours, deployed publicly, with no fakes anywhere.

---

## 0. Table of Contents

1. System overview and goals
2. Tech stack (locked)
3. Database schema
4. Authentication and sessions
5. Student-side pages
6. Corporate-side pages
7. API routes (complete list)
8. Core algorithms (with formulas)
9. Claude API integrations (5 distinct calls)
10. Bilingual implementation
11. Seed data
12. File and folder structure
13. Out of scope (explicit cuts)
14. The five demo moments
15. README and submission requirements
16. Risk register

---

## 1. System Overview and Goals

### What it is
CareerForge AI is a bilingual (Arabic / English) two-sided career intelligence platform for Saudi students and corporates. Students get a defensible readiness score, an AI-generated personalized roadmap, and direct visibility into open jobs ranked by fit. **Two distinct readiness metrics drive the student experience: a General Readiness (the cluster-wide career-readiness score shown on the dashboard) and a Job Readiness (a per-job match score shown on each job post), with AI-generated path suggestions for closing the gap on any specific job.** Corporates post structured job postings that feed the platform's market vector and gain access to ranked applicants with structured feedback mechanics.

### The two sides
- **Student side:** profile, readiness scoring, roadmap, simulator, mock interview, transcript Vision parsing, job browsing, applications, insights.
- **Corporate side:** signup with commercial registration capture, structured job posting, ranked applicants view, accept / reject with structured rejection reasons.

### The flywheel
Corporates post jobs → market vector is updated → student roadmaps recalibrate → students apply → corporates accept or reject with structured feedback → student profiles adjust → roadmaps recalibrate again.

### Judging weights (driving every priority decision)
| Criterion | Weight |
|---|---|
| Application and Programming | 25% |
| Innovation | 15% |
| UI Design | 15% |
| Output Impact | 15% |
| Sustainability | 10% |
| Work Plan | 10% |
| Skills and Experience | 5% |
| Presentation | 5% |

Application and Programming is weighted highest. Every feature must be real. No placeholders. No fakes.

---

## 2. Tech Stack (Locked)

| Layer | Tech | Notes |
|---|---|---|
| Framework | Next.js 14 App Router + TypeScript | One repo, frontend + API routes in one project |
| Styling | Vanilla CSS (port existing prototype `style.css`) | Skip Tailwind migration — save 2 hours |
| Database | Neon Postgres (paid tier acceptable) | Real persistent SQL database |
| ORM / queries | `postgres` (porsager/postgres) — lightweight, no codegen | Simpler than Prisma for 48h |
| Auth sessions | `iron-session` | Encrypted cookies, server-signed |
| Email OTP | Resend (free tier 3,000 emails / month) | Real email delivery |
| AI | `@anthropic-ai/sdk` calling Claude Sonnet 4.6 | All AI features real |
| Hosting | Vercel free tier | One-click GitHub deploy |
| Repo | GitHub public repo | Required for AI code review submission |
| File handling | In-memory processing, no persistence | Transcript / cert images go to Claude Vision, no disk storage |

**Environment variables required (in `.env.local`, never committed):**
```
DATABASE_URL=postgres://...
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
SESSION_PASSWORD=<random 32+ char string>
APP_URL=http://localhost:3000   # change to Vercel URL in production
```

A `.env.example` file with the same keys (no values) lives in the repo.

---

## 3. Database Schema

11 tables. All migrations live in `db/migrations/`. Schema generated and applied via the agent during Phase 1.

```sql
-- 3.1 users (base table for both roles)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,                                    -- bcrypt hash
  name TEXT NOT NULL,                                              -- full name (student or contact person)
  phone TEXT NOT NULL,                                             -- +966… preferred
  role TEXT NOT NULL CHECK (role IN ('student', 'corporate')),
  language_pref TEXT NOT NULL DEFAULT 'en' CHECK (language_pref IN ('en', 'ar')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.2 (deprecated) — no OTP table; password auth replaces email OTP.
--     Resend is still used for transactional emails (interview / offer).

-- 3.3 students (profile extends user)
-- ONBOARDING collects only: university, region, specialty, year_of_study, gpa_scale, gpa_value.
-- All other fields are filled in /profile after first dashboard view.
CREATE TABLE students (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- onboarding (6 required fields):
  university TEXT NOT NULL,
  region TEXT NOT NULL,
  specialty TEXT NOT NULL,
  cluster TEXT NOT NULL CHECK (cluster IN ('medicine','engineering','tech','unsupported')),
  year_of_study TEXT NOT NULL,           -- '1'..'6' or 'graduate'
  gpa_scale TEXT NOT NULL,                -- '4.0' / '5.0' / '100'
  gpa_value NUMERIC(5,2) NOT NULL,
  onboarding_completed_at TIMESTAMPTZ,
  -- profile completion fields (nullable until filled):
  city TEXT,
  opportunity_types JSONB NOT NULL DEFAULT '[]',   -- ['full_time','internship','coop','training']
  employment_experience TEXT,
  hours_per_week INT,
  interests JSONB NOT NULL DEFAULT '[]',
  target_role TEXT,                                  -- e.g. 'ml_engineer'
  profile_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.4 student_courses (from transcript Vision or manual entry)
CREATE TABLE student_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  course_name TEXT NOT NULL,
  course_code TEXT,
  credits NUMERIC(4,1),
  grade TEXT,
  semester TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','transcript_vision')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.5 student_experiences (certs, training, hackathons, events)
CREATE TABLE student_experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('certificate','training','hackathon','event','internship')),
  title TEXT NOT NULL,
  issuer TEXT,
  date_completed DATE,
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','pending','verified','rejected')),
  verification_method TEXT,    -- 'ai_inspection' / 'manual' / null
  verification_confidence NUMERIC(4,2),
  verification_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.6 student_dimensions (cached scores, recomputed on profile change)
CREATE TABLE student_dimensions (
  student_id UUID PRIMARY KEY REFERENCES students(user_id) ON DELETE CASCADE,
  dim_academic NUMERIC(5,2) NOT NULL DEFAULT 0,
  dim_credentialing NUMERIC(5,2) NOT NULL DEFAULT 0,
  dim_practical NUMERIC(5,2) NOT NULL DEFAULT 0,
  dim_portfolio NUMERIC(5,2) NOT NULL DEFAULT 0,
  dim_domain NUMERIC(5,2) NOT NULL DEFAULT 0,
  dim_prof_dev NUMERIC(5,2) NOT NULL DEFAULT 0,
  dim_soft_skills NUMERIC(5,2) NOT NULL DEFAULT 0,
  general_readiness NUMERIC(5,2) NOT NULL DEFAULT 0,
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.7 corporates
-- contact_name and phone live on users (the corporate user IS the contact person in v1).
CREATE TABLE corporates (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  sector TEXT NOT NULL CHECK (sector IN ('medicine','engineering','tech','other')),
  cr_number TEXT NOT NULL,    -- 10-digit Saudi CR
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending','verified')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.8 jobs
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corporate_id UUID NOT NULL REFERENCES corporates(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  posting_type TEXT NOT NULL CHECK (posting_type IN ('full_time','internship','coop','training')),
  role_category TEXT NOT NULL,         -- 'ml_engineer' / 'data_scientist' / etc.
  cluster TEXT NOT NULL CHECK (cluster IN ('medicine','engineering','tech')),
  description TEXT NOT NULL,
  location_region TEXT NOT NULL,
  location_city TEXT NOT NULL,
  salary_min INT,
  salary_max INT,
  required_skills JSONB NOT NULL DEFAULT '[]',     -- [{skill, importance}]
  required_certs JSONB NOT NULL DEFAULT '[]',
  required_experience_years INT NOT NULL DEFAULT 0,
  required_education_level TEXT NOT NULL,
  dimension_requirements JSONB NOT NULL,    -- {dim_academic: 60, dim_credentialing: 70, ...}
  hiring_outcome_flag BOOLEAN NOT NULL DEFAULT false,   -- Tier 1 trigger
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  is_seeded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.9 applications
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','under_review','interview','offered','rejected','withdrawn')),
  match_score NUMERIC(5,2) NOT NULL,
  rejection_primary_reason TEXT,
  rejection_gap_tags JSONB,     -- array of skill tags
  rejection_comment TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, student_id)
);

-- 3.10 roadmap_nodes
CREATE TABLE roadmap_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  dimension_target TEXT NOT NULL,    -- which of the 7 dims this node improves
  difficulty INT NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  hours INT NOT NULL,
  points INT NOT NULL,
  tier INT NOT NULL CHECK (tier BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'unlocked'
    CHECK (status IN ('locked','unlocked','in_progress','completed')),
  order_index INT NOT NULL,
  resources JSONB NOT NULL DEFAULT '[]',   -- [{title, url, provider, type, hours, language, cost}]
  why_this_tier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 3.11 mock_interview_sessions
CREATE TABLE mock_interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  scenario_key TEXT NOT NULL,
  response_text TEXT NOT NULL,
  clarity NUMERIC(4,1) NOT NULL,
  specificity NUMERIC(4,1) NOT NULL,
  relevance NUMERIC(4,1) NOT NULL,
  depth NUMERIC(4,1) NOT NULL,
  structure NUMERIC(4,1) NOT NULL,
  total_score NUMERIC(5,2) NOT NULL,
  feedback_text TEXT NOT NULL,
  improvement_areas JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.12 student_skills (manually entered via the conversational AI flow on /skills;
-- student picks the level (Low/Mid/High) themselves; AI only suggests and describes)
CREATE TABLE student_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  skill_key TEXT NOT NULL,                          -- kebab-case slug, used to match required_skills in jobs
  skill_canonical_name TEXT NOT NULL,                -- e.g. "Python"
  description_en TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  proficiency_level TEXT NOT NULL                    -- STUDENT'S choice
    CHECK (proficiency_level IN ('low','mid','high')),
  proficiency_score INT NOT NULL                     -- derived from level: low=30, mid=60, high=90
    CHECK (proficiency_score BETWEEN 0 AND 100),
  ai_suggested_level TEXT                            -- AI's initial suggestion (informational, nullable)
    CHECK (ai_suggested_level IN ('low','mid','high')),
  reasoning_en TEXT NOT NULL,
  reasoning_ar TEXT NOT NULL,
  iteration_count INT NOT NULL DEFAULT 0,            -- how many feedback rounds it took
  fully_approved BOOLEAN NOT NULL DEFAULT true,      -- false if 5-iteration cap was hit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, skill_key)
);
```

---

## 4. Authentication and Sessions

### Auth model
- **Email + password + phone**, no OTP for login.
- Passwords hashed with **bcryptjs** (cost factor 10).
- Phone collected at signup as a contact field (required, format-validated as Saudi phone: starts with `+966` or `05`).
- On login, server validates email + password, creates `iron-session` cookie containing `{ userId, role }`.
- Resend is still used — for **transactional emails only** (interview notification, offer notification), not auth.

### Student signup
1. Student visits `/signup`.
2. Form fields: full name, email, phone, password (min 8 chars, 1 letter + 1 number enforced server-side), confirm password.
3. POST `/api/auth/signup` → validates → hashes password → inserts row in `users` (role = 'student') → inserts row in `students` (empty profile shell) → creates session cookie → returns 200.
4. Redirect to `/onboarding`.

### Corporate signup
1. Corporate visits `/corporate/signup`.
2. Form fields: contact name, company name, sector (chips), CR number (10 digits, format-validated), email, phone, password, confirm password.
3. POST `/api/auth/signup` → validates → inserts `users` (role = 'corporate') + `corporates` (with CR + sector + company_name, status = 'pending') → creates session cookie.
4. Redirect to `/corporate/dashboard`.

### Login (both roles)
1. User visits `/login` (single page; detects role from email lookup).
2. Email + password form.
3. POST `/api/auth/login` → looks up user → `bcrypt.compare` → creates session → returns role.
4. Redirect based on role: student → `/dashboard` (or `/onboarding` if not completed), corporate → `/corporate/dashboard`.

### Logout
POST `/api/auth/logout` → destroys session → redirects to `/`.

### CR number capture (corporate signup)
- Stored as plain 10-digit string in `corporates.cr_number`.
- Format-validated: must be exactly 10 digits, first digit must be 1, 2, 3, 4, 5, 7, or 8 (real Saudi CR region codes).
- `verification_status` defaults to `'pending'`.
- Demo seeded corporate accounts are pre-set to `'verified'` with real public CR numbers from Wathq.
- Student-facing UI shows a verification badge next to company name on every job card.

### Session validation
- Helper `getSession()` in `lib/auth.ts` reads `iron-session` cookie, returns `{ userId, role } | null`.
- Helper `requireSession(role?)` wraps route handlers, returns 401 if absent or wrong role.

---

## 5. Student-Side Pages

| Path | Purpose | Auth required |
|---|---|---|
| `/` | Landing page (ported from prototype) | No |
| `/signup` | Email + name input, OTP request | No |
| `/verify` | OTP code entry | Partial (email in session storage) |
| `/onboarding` | 12-step conversational onboarding | Yes (student) |
| `/dashboard` | Main student view: readiness ring, top career matches, progress, recommended jobs, "Complete your profile" card | Yes (student) |
| `/profile` | View / edit profile fields, upload transcript image, add experiences | Yes (student) |
| `/skills` | Skill gap analysis: current skills vs target role requirements | Yes (student) |
| `/roadmap` | Roadmap timeline (5 tier colors) + Kanban view toggle | Yes (student) |
| `/simulator` | Career simulator with skill toggles and real-time score animation | Yes (student) |
| `/insights` | Real charts: career fit distribution, market demand, AI explanation | Yes (student) |
| `/mock-interview` | Text-based interview with scenario, response, scoring | Yes (student) |
| `/jobs` | Browse all open jobs, each with a **Job Readiness** score (per Section 8.2) | Yes (student) |
| `/jobs/[id]` | Job detail with dual readiness rings (General + Job Readiness) and AI-generated path to close the gap | Yes (student) |
| `/applications` | List of applications with status, view rejection details | Yes (student) |

### 5.1 Landing page (`/`)
Ported directly from the prototype. Hero section, features grid, CTA buttons. Language toggle in nav. Two CTAs: "Start as Student" → `/signup`, "Corporate Portal" → `/corporate`.

### 5.2 Onboarding (`/onboarding`)
**Six fields only.** One question per screen. Progress bar at top. The student lands on the dashboard immediately after step 6 with a prominent "Complete your profile" alert banner.

| Step | Field | Input type |
|---|---|---|
| 1 | University | Autocomplete (10 seeded Saudi universities) + "I'm not enrolled" toggle |
| 2 | Region | Chip selection (13 Saudi regions) |
| 3 | Specialty | Free text with autocomplete; auto-maps to cluster (medicine / engineering / tech / unsupported) |
| 4 | Year of study | Chip selection (1, 2, 3, 4, 5, 6, Graduate) |
| 5 | GPA scale | Chip selection (4.0 / 5.0 / 100) |
| 6 | GPA value | Slider, scale-aware |

Step 6 submit → `onboarding_completed_at` set → redirect to `/dashboard`.

**Important:** the roadmap is NOT generated at the end of onboarding. Roadmap generation requires `target_role` (collected in profile). The dashboard shows a "Complete your profile to generate your roadmap" CTA. The "Generate roadmap" button appears once the profile is sufficiently filled (minimum: target_role, opportunity_types, hours_per_week).

**Transcript is NOT in onboarding.** Transcript upload is the LAST section of the profile page, to avoid blocking onboarding if Claude Vision is slow or the image is unreadable.

### 5.3 Dashboard (`/dashboard`)
- **Complete Profile alert banner** at the top, dismissible only after profile completion. Displays until `students.profile_completed_at IS NOT NULL`. Shows: progress bar (X of Y profile fields complete), specific missing fields, primary CTA "Complete profile" → `/profile`.
- Welcome header with student name (from `users.name`) and last-updated timestamp (from `students.updated_at`).
- Career Readiness ring (animated SVG, computed from `student_dimensions.general_readiness`). Reads "Partial — complete profile for full score" until profile complete.
- Top Career Matches card: 4 roles with role-match scores, sorted descending. Filtered by `student.opportunity_types` once set.
- Progress Tracking card: skills acquired, certifications, projects, interview readiness.
- Recommended Jobs card: top 4 jobs by **Job Readiness** score (per Section 8.2 — distinct from the General Readiness on the ring above) with company verification badge. Filtered by `opportunity_types` once set.
- Quick Actions card: links to `/skills`, `/roadmap`, `/simulator`. Real AI Recommendation paragraph from Claude (loaded on first dashboard view, cached).
- **Generate Roadmap CTA:** large card visible only when profile is complete enough (target_role + opportunity_types + hours_per_week filled). Triggers `/api/roadmap/generate` and redirects to `/roadmap` on completion.

### 5.4 Profile (`/profile`)
Sections, top to bottom (transcript LAST to avoid blocking on Vision API):

**Section A — Basic info (editable)**
- Name, email, phone (from users)
- University, region, specialty, year, GPA scale, GPA value (from onboarding)

**Section B — Goals (required for roadmap)**
- City (chips, filtered by region)
- What are you looking for? (multi-select chips: Full-time job / Internship / COOP / Training program) → saved to `students.opportunity_types`
- Target role (chips from role catalog, filtered by cluster + selected opportunity types)
- Available hours per week (slider 1–40)
- Fields of interest (multi-select chips, 8 options)

**Section C — Experience**
- Employment / training experience (free-text textarea + chip prompts)
- Experiences list: certificates, training programs, hackathons, events, internships
  - "Add experience" → form with type chips, title, issuer, date, status defaults to `unverified`. v1 has no AI cert inspection — marking verification is manual / admin-only.

**Section D — Academic transcript** (last)
- "Upload transcript image" button (jpg / png only).
- File goes to POST `/api/students/transcript/parse` (multipart).
- Server converts to base64, calls Claude Vision with structured prompt, returns JSON courses.
- UI shows editable table of extracted courses. Yellow highlight on low-confidence fields (`confidence < 0.7`).
- Student edits / confirms / deletes rows.
- Save → POST `/api/students/courses` writes to `student_courses` → triggers `/api/readiness/recompute`.
- Skippable. The student can complete the rest of the profile without uploading a transcript. Roadmap can still generate without transcript data.

**Profile completion logic:**
- `profile_completed_at` is set when Sections A and B are fully filled (transcript and experiences optional).
- Once set, the "Complete profile" banner on the dashboard disappears and the "Generate roadmap" CTA appears.

### 5.5 Skills (`/skills`)

**Three sections, top to bottom:**

**Section A — Add a skill (the conversational AI flow)**
At the top of the page: a text input with placeholder *"What's a skill you have? (e.g., Python, Photoshop, Surgery, AutoCAD)"*.

The conversational flow:
1. Student types a skill name + presses Add.
2. Loading state: *"Analyzing your skill..."*
3. **Real Claude call (#5)** generates:
   - A description of what the skill is and why it matters in the Saudi job market.
   - A *suggested* starting level (Low / Mid / High) based on student profile context — informational only, the student decides.
   - Reasoning for the suggestion.
4. UI shows a chat-bubble card with:
   - The AI description (current language).
   - **Three level chips: Low / Mid / High.** The AI's suggested level is pre-selected. **The student can change it.** This is the student's call, not the AI's.
   - Two action buttons:
     - **"Save with this level"** (green) → persists to `student_skills`. `proficiency_score` is derived: Low → 30, Mid → 60, High → 90. Input clears for next skill.
     - **"Not quite..."** → expands a textarea for refinement.
5. If "Not quite...": student types correction → Claude regenerates description + suggested level with the new context → loop.
6. **5-iteration hard cap per skill.** On iteration 5 the latest output auto-saves with `fully_approved = false` and a small "needs review" badge on the row. Protects the Anthropic API budget from indecision loops.
7. "Done adding skills" link closes the section.

**Section B — Your current skills + Required for [target role]**

*Left card — Your current skills:*
- One horizontal bar per row in `student_skills`. Bar fill = `proficiency_score` (30 / 60 / 90 from the student's level choice).
- Each row shows:
  - Skill name
  - Level chip (Low / Mid / High)
  - Bar with percentage
  - **🔥 "In demand" badge** if this skill is required by **3 or more open jobs** in the student's cluster. This is the visible market influence.
  - (i) info icon → opens skill detail modal.
- Below the manually-added skills, dimmer rows show skills derived from courses / experiences / interests that the student hasn't explicitly added (informational only — no level chip, no edit option).

*Right card — Required for [target role]:*
- Aggregated required skills from open jobs matching `role_category = student.target_role`, weighted by importance.
- Each bar shows average required importance + count of jobs requiring it.

**Skill detail modal (click (i) on any manually-added skill):**
- AI-generated description.
- AI's suggested level vs the student's chosen level (e.g., *"AI suggested Mid; you rated Low"*).
- AI's reasoning.
- Market demand readout: *"Required by N open jobs in your cluster, average importance X/5."*
- "Edit" button → reopens the conversational flow for this skill with current state pre-loaded.

For derived skills (courses / experiences / interests), the modal shows the deterministic data-source explanation instead.

**Section C — Status overview**
Chips: green for skills the student has (manually added + derived), red for skills the role requires that the student hasn't added.

---

**Important: market demand influences readiness math, not the bar UI.**

The `proficiency_score` per skill is fixed by the student's level choice (30 / 60 / 90). The bar on screen always shows this base value — what the student actually said they know.

But in `lib/readiness.ts` (see Section 8.1), each skill's contribution to `dim_domain` is multiplied by a **market demand multiplier** (1.0× to 2.0×) based on how many open jobs in the student's cluster require that skill. **When corporates post new jobs requiring skills the student has, the student's general readiness number ticks up on next recompute.** When jobs requiring those skills close or change, it ticks down. The bar UI stays honest; the readiness number is market-aware. This makes Demo Moment 3 (corporate posts → student state changes) visible in two places: a new Tier-1 roadmap node AND a readiness number bump.

### 5.6 Roadmap (`/roadmap`)
- Timeline view (primary): horizontal scrubbable timeline with 8–12 nodes, color-coded by tier.
- Kanban view (toggle): three columns — Active, In Progress, Completed.
- Each node card shows: title, description, tier color, difficulty, hours, points, dimension target, resources list, "Mark complete" button, "Why this tier?" expandable explanation.
- Click "Mark complete" → POST `/api/roadmap/nodes/[id]/complete` → updates node status, triggers readiness recompute, animates new score.

### 5.7 Simulator (`/simulator`)
- Left card: 6–8 skill toggles relevant to student's cluster (from boost matrix).
- Right card: simulated score ring + simulated career matches.
- Toggle a skill → POST `/api/simulator/compute` (or compute client-side from cached boost matrix) → animate score.
- Boost matrix exposed via GET `/api/simulator/boost-matrix` on page load.

### 5.8 Insights (`/insights`)
All charts driven by real data. No salary projection.

| Chart | Data source |
|---|---|
| Career Fit Distribution | Computed: student's role-match score against each of 6 role categories (from seeded + posted jobs aggregated) |
| Market Demand Trends | Computed: count of jobs per skill category from `jobs` table |
| AI Decision Explanation: "Why this role?" | Real Claude call (POST `/api/insights/ai-explanation`) explaining the top-match role for this student |
| AI Decision Explanation: "Growth Trajectory" | Real Claude call (same endpoint, different prompt section) |

### 5.9 Mock Interview (`/mock-interview`)
1. Scenario displayed (3 seeded scenarios per cluster; one picked based on student's cluster).
2. Student types response into textarea (min 50 chars).
3. Submit → POST `/api/mock-interview/score` → Claude returns rubric scores + feedback + 3 improvement areas.
4. Results screen: 5 score bars (clarity, specificity, relevance, depth, structure), total score, feedback paragraph, "Improvement Areas" list.
5. Each improvement area shows a "Add to roadmap" button → POST `/api/roadmap/nodes` creates a new Tier-3 practice node with the area as the dimension target.

### 5.10 Jobs (`/jobs`)
- Filter bar: cluster, region, salary range.
- Sort: by **Job Readiness** (default), by date posted, by deadline.
- Job cards show: title, company name + verification badge, location, salary range, **Job Readiness** percentage with color band (this is the per-job match score from Section 8.2 — distinct from the dashboard's General Readiness), skills required preview, "Apply" button.

### 5.11 Job detail (`/jobs/[id]`)

**Header — Dual Readiness Display (the key UX moment for this page):**
- TWO side-by-side rings, equal visual weight, labeled clearly:
  - **LEFT ring: "Your General Readiness"** — pulled from `student_dimensions.general_readiness`. The same number the student sees on their dashboard. Reflects overall career-readiness in their cluster. See Section 8.1.
  - **RIGHT ring: "Your Job Readiness"** — computed live for this specific job using the role-match formula in Section 8.2 against this job's `dimension_requirements`, `required_skills`, `required_certs`, and `required_experience_years`. **This number is distinct from General Readiness and will often differ** — a student with 70% General Readiness may have 85% Job Readiness on a job that aligns with their strengths, or 55% on a job that requires what they lack.
- Below the two rings, a one-line auto-generated explanation: *"This job emphasizes {top_2_required_dimensions}. Your strongest contributing dimension here is {x}; your biggest gap is {y}."*

**Body:**
- Full description.
- Required skills list (full list with importance dots).
- Top 3 strengths and top 2 gaps relative to this job (computed from the dimension delta + skill overlap).

**"Close the Gap" — Path to Improve Your Job Readiness (NEW section, AI-generated per job):**
- A card titled *"How to raise your readiness for this job"* / *"كيف ترفع جاهزيتك لهذه الوظيفة"*.
- Contains 3–5 specific, actionable steps generated by Claude (#6 — see Section 9.6). Each step targets a REAL gap from this job's requirements vs the student's profile — never generic advice.
- Each step card shows: title (bilingual), description (bilingual), dimension target tag, estimated hours, **expected lift** (e.g., *"+8% Job Readiness"*), 1–2 resource links.
- Each step has an **"Add to my Roadmap"** button → POST `/api/roadmap/nodes` creates a new tier-2 roadmap node with this step's payload + a note in the description: *"From: {job title} at {company name}"*. The student can then track it from `/roadmap` alongside their main roadmap.
- Loaded on first page visit via GET `/api/jobs/[id]/path` (real Claude call). Result cached in component state for the session — no re-fetch on Apply button click or scroll.
- Empty state (rare — only if Job Readiness is already ≥ 95%): *"You're already well-matched for this job. Apply with confidence."*

**Apply button** → POST `/api/jobs/[id]/apply` → creates `applications` row → redirect to `/applications` with success toast.

### 5.12 Applications (`/applications`)
- List of all applications with status badges.
- Click → expandable detail showing structured rejection if status is `rejected`: primary reason, gap tags, optional comment.
- "Add gaps to roadmap" button → triggers roadmap recompute to promote those gaps.

---

## 6. Corporate-Side Pages

| Path | Purpose | Auth required |
|---|---|---|
| `/corporate` | Corporate landing | No |
| `/corporate/signup` | Company name, sector, CR number, contact info | No |
| `/corporate/verify` | OTP code entry | Partial |
| `/corporate/dashboard` | Overview of postings, recent applicants | Yes (corporate) |
| `/corporate/post-job` | Job posting wizard (10 fields) | Yes (corporate) |
| `/corporate/jobs/[id]/applicants` | Ranked applicants list | Yes (corporate) |
| `/corporate/jobs/[id]/applicants/[appId]` | Applicant detail + accept / reject form | Yes (corporate) |

### 6.1 Corporate signup (`/corporate/signup`)
Single form, ~45 seconds to fill:
- Company name (text)
- Sector (chips: medicine / engineering / tech / other)
- CR number (10 digits, format-validated client-side)
- Contact name (text)
- Contact phone (text, +966 default)
- Contact email (will receive OTP)

### 6.2 Corporate dashboard (`/corporate/dashboard`)
- Verification status banner (yellow if pending, green if verified).
- "Post a new job" CTA.
- Active postings list with applicant count per job.
- Recent applicants feed (across all jobs).

### 6.3 Post job (`/corporate/post-job`)
**10 structured fields. Every field required.** Validation enforced client-side and server-side.

| Field | Input |
|---|---|
| Title | Text |
| Role category | Dropdown (8 options per cluster) |
| Cluster | Auto-set from corporate's sector |
| Description | Textarea |
| Location region | Chip selection |
| Location city | Chip selection |
| Salary range (min, max) | Two numeric inputs, SAR |
| Required skills | Multi-select chips from skill ontology (10–15 visible options for the cluster) with importance slider 1–5 per skill |
| Required certs | Multi-select chips from cert ontology |
| Required experience (years) | Numeric input |
| Required education level | Dropdown (high school / bachelor / master / PhD) |
| Hiring outcome flag | Checkbox: "This posting offers a direct hire / camp / program with employment outcome" — promotes to Tier 1 in matched student roadmaps |
| Deadline | Date picker |

On submit:
1. POST `/api/corporates/jobs` → validates all fields → computes `dimension_requirements` from the structured inputs using `lib/job-vector.ts` → inserts row → triggers roadmap recompute for matching students (cluster-relevant, currently active students).
2. Redirect to `/corporate/dashboard` with success toast.

### 6.4 Applicants (`/corporate/jobs/[id]/applicants`)
- List sorted by `match_score` descending.
- Each row: student name, university, year, match score with color band, top 3 strengths, top 2 gaps.
- Click → applicant detail page.

### 6.5 Applicant detail
- Full profile view.
- Strengths and gaps breakdown.
- Action buttons:
  - "Move to under review" → updates status only.
  - **"Schedule interview" → updates status to `interview` AND triggers Resend email to the student** ("You have an interview for [job title] at [company]. The company will contact you within 48 hours at [student phone] or [student email]."). Email template: bilingual with student's `language_pref`.
  - **"Offer" → updates status to `offered` AND triggers Resend email** containing the corporate's contact info ("[Company] has extended you an offer. Contact them at [corporate email / phone] for negotiation details.") Negotiation happens off-platform.
  - "Reject" → opens structured rejection modal.

### 6.6 Structured rejection modal
**Cannot bypass.** Required fields:
- Primary reason (dropdown):
  - Missing required skills
  - Insufficient experience
  - Missing required credential
  - Better-matched candidate selected
  - Role filled before review
  - Other (requires text)
- Specific gaps (multi-select chips, drawn from the job's required_skills list)
- Optional comment (textarea)

Submit → POST `/api/corporates/applications/[id]/reject` → updates `applications` row with structured rejection → triggers roadmap recompute on the affected student to promote the gap tags.

---

## 7. API Routes (Complete List)

### Auth
- `POST /api/auth/signup` — body: `{ email, password, name, phone, role, ...roleSpecific }`. Hashes password (bcrypt), creates `users` + role row, creates session. Returns 200.
- `POST /api/auth/login` — body: `{ email, password }`. Validates, creates session, returns `{ role }`. Returns 200 or 401.
- `POST /api/auth/logout` — destroys session. Returns 200.
- `GET /api/auth/me` — returns current session user info. Returns 200 or 401.

### Student profile
- `GET /api/students/profile` — current student (joined with users).
- `PATCH /api/students/profile` — update any subset of fields.
- `POST /api/students/transcript/parse` — multipart with image. Returns `{ courses: [...] }`. **Real Claude Vision call.**
- `POST /api/students/courses` — body: array of courses. Replaces or appends.
- `POST /api/students/experiences` — body: `{ type, title, issuer, date }`. No image / no Claude call in v1.

### Readiness
- `GET /api/readiness` — returns current student's 8-dim breakdown + general score.
- `POST /api/readiness/recompute` — recomputes scores from current profile. Used after any profile change.

### Roadmap
- `POST /api/roadmap/generate` — generates roadmap from current profile + target role. **Real Claude call.** Persists to `roadmap_nodes`.
- `GET /api/roadmap` — returns ordered nodes for current student.
- `POST /api/roadmap/nodes/[id]/complete` — marks node completed, triggers readiness recompute.
- `POST /api/roadmap/nodes` — creates a new node (used by mock interview "Add to roadmap" flow).
- `POST /api/roadmap/recompute-affected` — internal; called by corporate job posting to re-rank tiers for matching students.

### Mock interview
- `GET /api/mock-interview/scenario` — returns one scenario matching student's cluster.
- `POST /api/mock-interview/score` — body: `{ scenarioKey, responseText }`. **Real Claude call.** Returns rubric + feedback. Persists session.

### Skills
- `GET /api/skills/current` — returns student_skills rows joined with computed `market_demand_count` (count of open jobs in student's cluster requiring each skill). Used to render the bars and "🔥 In demand" badges.
- `GET /api/skills/required` — returns aggregated required skills for the student's target role from open jobs.
- `POST /api/skills/describe` — body: `{ skill_input: string, iteration_history?: [{ai_output, student_feedback}] }`. **Real Claude call (#5)** generates description + suggested level + reasoning. Returns the AI output JSON. Does NOT persist — only persists when student confirms via `/api/skills/save`.
- `POST /api/skills/save` — body: `{ skill_key, skill_canonical_name, description_en, description_ar, proficiency_level, ai_suggested_level, reasoning_en, reasoning_ar, iteration_count, fully_approved }`. Persists to `student_skills`. Triggers `/api/readiness/recompute` (so the dashboard readiness updates).
- `DELETE /api/skills/[id]` — removes a skill row.

### Simulator
- `GET /api/simulator/boost-matrix` — returns the static boost matrix for the student's cluster.
- `POST /api/simulator/compute` — body: `{ activeSkills: [...] }`. Returns simulated dimension scores + role-match deltas.

### Jobs (student view)
- `GET /api/jobs` — list open jobs with **Job Readiness** score per job for current student (per Section 8.2).
- `GET /api/jobs/[id]` — full detail. Response includes the student's `general_readiness` (from cache), the freshly-computed `job_readiness` for this job, and the strengths/gaps breakdown used by the dual-ring header.
- `GET /api/jobs/[id]/path` — **real Claude call (#6)**. Returns 3–5 AI-generated path steps to close the gap between this student and this specific job. Response shape: `{ steps: [{ title_en, title_ar, description_en, description_ar, dimension_target, estimated_hours, expected_lift, resources: [...] }] }`. Cached client-side for the session; not persisted server-side (steps only enter the DB if the student clicks "Add to my Roadmap" on one of them, which goes through the existing `POST /api/roadmap/nodes`).
- `POST /api/jobs/[id]/apply` — creates application row.

### Insights
- `GET /api/insights/career-fit` — computed distribution.
- `GET /api/insights/market-demand` — computed skill demand.
- `POST /api/insights/ai-explanation` — **real Claude call** for "why this role" + "growth trajectory."

### Corporate
- `GET /api/corporates/profile` — current corporate.
- `PATCH /api/corporates/profile` — update.
- `POST /api/corporates/jobs` — create job posting. Triggers roadmap recompute for matching students; if `hiring_outcome_flag=true`, adds a new Tier-1 node to their roadmaps.
- `GET /api/corporates/jobs` — list this corporate's jobs.
- `GET /api/corporates/jobs/[id]/applicants` — ranked applicants list.
- `POST /api/corporates/applications/[id]/status` — body: `{ status }`. For status changes. **If status = 'interview' or 'offered', sends Resend email to the student.**
- `POST /api/corporates/applications/[id]/reject` — body: `{ primaryReason, gapTags, comment? }`. Triggers student roadmap recompute to promote gap tags.

---

## 8. Core Algorithms (with Formulas)

All algorithms live under `lib/`. Each file has inline comments explaining the math.

### 8.1 General Readiness Scoring (`lib/readiness.ts`)

**This is the GENERAL Readiness — the single number shown on the student's dashboard ring and the number that defines their overall career-readiness in their chosen cluster.** It is computed deterministically from real student data (the formulas below have no AI in them — the math is fully traceable, reproducible, and defensible to judges). It is **cluster-aware** (Medicine vs Engineering vs Tech weights are different) and **market-aware** (the Domain dimension multiplies skill contributions by live market demand from corporate postings).

**It is NOT job-specific.** For the per-job readiness number displayed on each job post, see Section 8.2. A student's General Readiness and their Job Readiness for a particular post are computed from the same 7 dimensions but answer different questions:
- General Readiness asks: *"How career-ready is this student in their cluster, given the current Saudi job market?"*
- Job Readiness asks: *"How well does this student's profile match THIS specific job's requirements?"*

**Cluster weights** (sum to 100 for the 7 dimensions used in general readiness; Specialty Alignment is used only in role-matching):

| Dimension | Medicine | Engineering | Tech |
|---|---|---|---|
| Academic | 25 | 20 | 15 |
| Credentialing | 25 | 18 | 15 |
| Practical | 20 | 15 | 15 |
| Portfolio | 8 | 22 | 30 |
| Domain | 10 | 12 | 15 |
| Prof Dev | 5 | 5 | 5 |
| Soft Skills | 7 | 8 | 5 |

**Sub-formulas per dimension:**
- `dim_academic = (gpa_normalized * 0.6) + (year_progress * 0.3) + (university_tier * 0.1)`, where:
  - `gpa_normalized` = GPA / scale × 100
  - `year_progress` = year / 6 × 100 (or 100 for graduate)
  - `university_tier` = 100 if KSU/KFUPM/KAUST/KAU/IAU/PNU/KSAU-HS/KFU; else 70; else 50 if not listed
- `dim_credentialing = min(100, count(verified_certs) × 20 + count(pending_certs) × 5)`
- `dim_practical = min(100, count(internships + hackathons + events) × 15)`
- `dim_portfolio = min(100, count(projects from interests + completed nodes with type 'project') × 10)`
- `dim_domain` (NEW — market-aware):
  ```
  dim_domain = min(100,
      courses_contribution
    + experiences_contribution
    + skills_contribution
  )
  where:
    courses_contribution = count(courses matching cluster keywords) × 5      (cap 50)
    experiences_contribution = count(student_experiences with type 'certificate' or 'training') × 4   (cap 20)
    skills_contribution = sum over each student_skills row of:
        base = proficiency_score / 10                                         (Low=3, Mid=6, High=9)
        market_demand_count = count of open jobs in student's cluster whose required_skills includes this skill_key
        market_multiplier = 1.0 + min(1.0, market_demand_count / 5)           (1.0 → 2.0, saturates at 5+ jobs)
        per_skill = base × market_multiplier                                  (cap 20 per skill)
  ```
  The market_multiplier is what makes the readiness number market-aware. A High-proficiency skill required by 5+ jobs contributes 18 points; a High-proficiency skill required by 0 jobs contributes 9 points. When corporates post new jobs requiring skills the student has, dim_domain (and therefore general_readiness) ticks up on next recompute.
- `dim_prof_dev = min(100, count(experiences of type 'event' or 'hackathon') × 20)`
- `dim_soft_skills = avg(mock_interview_total_scores) || 0`

**General readiness:**
```
general = Σ (dim[i] × cluster_weight[i] / 100)
```

### 8.2 Job-Specific Readiness — a.k.a. Job Readiness / Role-Match (`lib/role-match.ts`)

**This is the SECOND readiness number — distinct from the General Readiness in Section 8.1.** It is the percentage shown on the right ring of the job detail page (Section 5.11) and on every job card in the listings (Section 5.10). It answers: *"How well does this student's profile match THIS specific job's structured requirements?"*

The same student can have very different General and Job Readiness numbers. Example:
- Khaled (Tech cluster) has **General Readiness = 70%** because his portfolio and credentialing are average across the cluster overall.
- He opens an ML Engineer post that emphasizes Python, statistics, and a portfolio of small ML projects — three things Khaled is strong in.
- His **Job Readiness for this post = 82%** because his strongest dimensions happen to be exactly what this job weights highest.
- He opens a Full-Stack Dev post that emphasizes frontend frameworks and devops — areas Khaled is weak in.
- His **Job Readiness for that post = 58%**, even though his General Readiness is still 70%.

This is why the dual-ring display on the job detail page matters: it shows the student where they stand overall AND where they stand for this specific opportunity.

**Formula.** Given student vector `S = (s_academic, ..., s_soft_skills)` from `student_dimensions`, and the job's required vector `R = (r_academic, ..., r_soft_skills)` from `jobs.dimension_requirements`:

```
deficit[i] = max(0, R[i] - S[i])    // we only penalize underperformance
weighted_distance = sqrt(Σ (cluster_weight[i] * deficit[i]²) / 100)
max_distance = sqrt(Σ (cluster_weight[i] * 100²) / 100) = 100
match_score = round(100 × (1 - weighted_distance / max_distance))
```

### 8.3 Points formula (`lib/points.ts`)

From the doc:
```
points = round(difficulty × hours × (dimension_weight × 10) × tier_multiplier)
```
Tier multipliers: T1 = 2.0, T2 = 1.5, T3 = 1.2, T4 = 1.0, T5 = 0.7.

### 8.4 Job dimension vector (`lib/job-vector.ts`)

When a corporate posts a job, the structured fields produce a required dimension vector:

```
dim_academic = 50 + (education_level_score × 10) + (required_experience_years × 5), capped 100
dim_credentialing = required_certs.length × 20, capped 100
dim_practical = required_experience_years × 15, capped 100
dim_portfolio = required_skills.filter(s => s.importance >= 3).length × 10, capped 100
dim_domain = required_skills.length × 5, capped 100
dim_prof_dev = 40 (constant for now)
dim_soft_skills = 60 (constant for now)
```

Education level score: high_school = 1, bachelor = 3, master = 4, phd = 5.

### 8.5 Simulator boost matrix (`lib/simulator.ts`) — DYNAMIC

The boost matrix is **computed live from real job data**, not stored as a static file. This is what makes the simulator a reflection of the actual Saudi market.

**Computation (`GET /api/simulator/boost-matrix`):**
1. Get the student's cluster.
2. Query all open jobs in that cluster.
3. For each `(skill, role_category)` pair:
   - Find jobs with that `role_category` that include `skill` in their `required_skills` JSONB array.
   - Sum the `importance` values (1–5) across those jobs.
   - Normalize: `boost = round((sum_importance / total_jobs_in_role_category) × 2)`, capped at 10.
4. Return as JSON: `{ skill_key: { role_category: boost_int } }`.

**Effect:** When a corporate posts a new job, the next time any student loads `/simulator`, the boost values reflect the new posting. The simulator becomes a live readout of market demand.

**Cache:** Compute on each `GET /api/simulator/boost-matrix` request. With 15–50 jobs at demo scale, this is a single SQL query + in-memory aggregation; ~10ms. No caching needed for demo.

### 8.6 Cluster auto-mapping (`lib/cluster.ts`)

Free-text specialty → cluster mapping. Simple keyword match:
- Contains "medic", "pharm", "dent", "nurs", "surg", "health" → medicine
- Contains "engin", "civil", "mech", "elec", "chem", "indust" → engineering
- Contains "comput", "softw", "data", "ai", "ml", "info", "cyber" → tech
- Else → unsupported

---

## 9. Claude API Integrations (6 Distinct Calls)

All prompts live in `lib/prompts/*.ts`. Each is a TypeScript function returning a `{ system, messages }` object. Each call uses Claude Sonnet 4.6 (`claude-sonnet-4-5-20250929` — confirm in Antigravity before build) with structured JSON output where applicable.

### 9.1 Roadmap generation (`lib/prompts/roadmap.ts`)
**Input:** student profile + 7-dim scores + target role + gap vector.

**Prompt (abbreviated):**
> You are generating a personalized career roadmap for a Saudi student. The student's profile is: [summary]. Their target role is [role]. The gap vector showing where they fall short of the role's requirements is: [vector].
>
> Generate 10–12 roadmap nodes, each addressing one of the top gaps. For each node return:
> - title (English and Arabic)
> - description (English and Arabic, 1–2 sentences)
> - dimension_target (one of: academic, credentialing, practical, portfolio, domain, prof_dev, soft_skills)
> - difficulty (1–5)
> - hours (estimated)
> - tier (1–5, where 1 is most urgent based on Saudi job market relevance)
> - resources (3 per node): array of {title, url, provider, type, hours, language, cost}
> - why_this_tier: one-sentence explanation
>
> Bias resources toward Coursera, edX, Tuwaiq Academy, Misk Academy, MIT OCW, freeCodeCamp, official docs. Return ONLY a JSON array of node objects.

**Output validation:** parse as JSON, validate against Zod schema, reject and retry once on failure.

### 9.2 Transcript Vision (`lib/prompts/transcript.ts`)
**Input:** base64 image (jpg/png).

**Prompt:**
> You are extracting course data from a Saudi university transcript image. Return ONLY valid JSON, no prose.
>
> Schema: array of `{ course_name, course_code, credits, grade, semester, confidence }` where confidence is 0–1.
>
> Handle Arabic-English mixed transcripts. Return original language for course names. If extraction is uncertain for any field, set confidence < 0.7 and return your best guess.

### 9.3 Mock interview scoring (`lib/prompts/mock-interview.ts`)
**Input:** scenario text + response text.

**Prompt:**
> You are an interview coach scoring a candidate's response. The scenario is: [scenario]. The candidate's response is: [response].
>
> Score the response on five dimensions, each 0–20:
> - clarity (well-structured, easy to follow)
> - specificity (concrete examples vs vague)
> - relevance (answers what was asked)
> - depth (surface vs thoughtful)
> - structure (STAR or other logical organization)
>
> Return JSON: `{ clarity, specificity, relevance, depth, structure, total, feedback: "...", improvement_areas: [{area, suggestion}, ...] }`. Provide 3 improvement areas. Be honest. Be specific.

### 9.4 AI insight explanation (`lib/prompts/insight-explanation.ts`)
**Input:** student profile summary + top-match role + match score breakdown.

**Prompt:**
> Explain in 2–3 sentences why this Saudi student is well-matched to this role, citing specific strengths from their profile. Then in 2–3 sentences describe the growth trajectory for this role in the Saudi market. Reference Vision 2030 themes where relevant.
>
> Return JSON: `{ why_this_role_en, why_this_role_ar, growth_trajectory_en, growth_trajectory_ar }`.

### 9.5 Skill description generator (`lib/prompts/skill-description.ts`)
**Input:** student's typed skill name + student profile context + iteration history (previous AI outputs and student feedback).

**Prompt template:**
> A Saudi student is cataloging their skills. They typed: "[skill_input]".
>
> Student profile context:
> - Specialty / cluster: [cluster] / [specialty]
> - Year of study: [year]
> - GPA: [gpa_value] / [gpa_scale]
> - Target role: [target_role]
> - Other skills already in profile: [list with their levels, e.g. "Python (mid), SQL (high)"]
>
> Previous iterations for this skill (if any):
> [iteration_history of previous AI outputs and student feedback comments]
>
> Generate this JSON exactly:
> ```
> {
>   "skill_key": "kebab-case-slug",
>   "skill_canonical_name": "Proper Name",
>   "description_en": "2-3 sentences in plain language: what this skill is, why it matters in the Saudi job market.",
>   "description_ar": "نفس الوصف باللغة العربية",
>   "suggested_level": "low" | "mid" | "high",
>   "reasoning_en": "1-2 sentences: why this level is a reasonable starting point for someone with this student's profile. Frame it as a SUGGESTION — the student decides their actual level.",
>   "reasoning_ar": "السبب باللغة العربية"
> }
> ```
>
> Rules:
> - The student picks the actual level themselves. Your `suggested_level` is a starting hint, NOT a decision.
> - If `iteration_history` contains corrections, weight them heavily — the student knows their skills better than you.
> - Level meanings: low = beginner / learning fundamentals; mid = comfortable applying it independently on small projects; high = production / professional / can teach others.
> - Return ONLY valid JSON. No prose outside the JSON.

The response is shown to the student. The student picks Low / Mid / High themselves (AI's suggestion is pre-selected for convenience). On save, `proficiency_score` is derived: low → 30, mid → 60, high → 90.

### 9.6 Job-specific path suggestion (`lib/prompts/job-path.ts`) — Claude #6

**Purpose.** When a student is viewing a job post, the "Close the Gap" card on `/jobs/[id]` (Section 5.11) calls this prompt to generate 3–5 specific, actionable steps that would raise the student's **Job Readiness** for THIS job. This is distinct from the general roadmap (Section 9.1, Claude #2): the roadmap targets the student's chosen `target_role` long-term; this prompt targets one specific open posting in front of them right now.

**Input:**
- Student profile summary (cluster, year, GPA, target_role, opportunity_types)
- Student's current 7-dim vector from `student_dimensions`
- Student's General Readiness number
- Student's current Job Readiness for this post (already computed via Section 8.2 before this call)
- The job's full structured fields: title, role_category, required_skills (with importance), required_certs, required_experience_years, required_education_level, dimension_requirements
- The computed gap: per-dimension deltas (where student < job requirement) + list of missing skills + list of missing certs

**Prompt (abbreviated):**
> A Saudi student is viewing a specific job posting and wants to know how to raise their readiness for it. Their general readiness across the cluster is [N]%. Their readiness for this specific job is [M]%.
>
> Student profile: [summary].
> Job: [title] at [company]. Required dimension vector: [R]. Required skills (with importance 1–5): [list]. Required certifications: [list]. Required experience: [N] years. Required education: [level].
> Computed gap (where student falls short of this job specifically): [per-dimension deltas + missing skills + missing certs].
>
> Generate 3–5 SPECIFIC, ACTIONABLE steps that would close the gap for THIS job. Every step must address a real, named gap from the input — never generic advice. For each step return:
> - title_en, title_ar
> - description_en, description_ar (1–2 sentences each)
> - dimension_target (one of: academic, credentialing, practical, portfolio, domain, prof_dev, soft_skills)
> - estimated_hours (integer, realistic)
> - expected_lift (integer 1–15, your honest estimate of how many points this step adds to JOB readiness for this specific post)
> - resources (1–2 per step): array of `{title, url, provider, type, hours, language, cost}`
>
> Prioritize steps that close the BIGGEST gaps first. Bias resources toward Saudi-friendly options first (Tuwaiq Academy, Misk Academy, SDAIA Academy) then Coursera / edX / freeCodeCamp / official docs. Return ONLY a JSON array of step objects, no prose.

**Output validation.** Parse as JSON, validate with Zod, retry once on malformed response, then fail with a real error message — no fake fallback content (consistent with the project-wide "no fakes" rule).

**Caching.** Result cached client-side for the current page-view session. Re-fetched if the student navigates away and back. Not persisted server-side — only the steps the student explicitly clicks "Add to my Roadmap" on become `roadmap_nodes` rows.

---

## 10. Bilingual Implementation

- React Context `LanguageProvider` wraps the app in `app/layout.tsx`. State: `'en' | 'ar'`.
- `useTranslation()` hook returns `t(key)` looking up `i18n/en.json` or `i18n/ar.json`.
- Document direction set via `<html dir={lang === 'ar' ? 'rtl' : 'ltr'}>` (effected via `useEffect` on language change).
- Static UI strings: all keys live in JSON files. No hardcoded English strings anywhere outside dev tooling.
- AI-generated content: Claude returns both `_en` and `_ar` keys in JSON. Both stored in DB. Renderer picks based on current lang.
- Numbers always LTR (per Saudi convention).
- Fonts: Inter (Latin), IBM Plex Sans Arabic. Already in prototype's `style.css`.

---

## 11. Seed Data

Loaded via `data/seed.sql` or `scripts/seed.ts` (agent picks the cleaner of the two).

### 11.1 Lookup tables
- 13 Saudi regions (constant)
- ~30 cities (3–5 per region)
- 10 Saudi universities (KSU, KAU, KFUPM, IAU, PNU, KSAU-HS, KFU, Umm Al-Qura, Imam Muhammad bin Saud, Taibah)
- Skill ontology: ~30 skill slugs across the 3 clusters
- Boost matrix: as in 8.5
- Role catalog: 6–8 roles (ML Engineer, Data Scientist, AI Researcher, Full-Stack Dev, ...)

### 11.2 Demo accounts
- 1 demo student account, pre-onboarded, all 12 fields filled, target role = ML Engineer. Generated roadmap, sample completed nodes, 1 mock interview session.
- 1 demo corporate account, verified, with 3 already-posted jobs.

### 11.3 Seeded jobs
**15 jobs, Tech cluster only**, marked `is_seeded = true`, all from real Saudi employers:

| Role | Employer | Quantity |
|---|---|---|
| ML Engineer | Aramco Digital, STC, SDAIA, Tabby, Mozn | 5 |
| Data Scientist | STC, SDAIA, Tamara, Hala, Lean Business Services | 5 |
| Full-Stack Dev | Tabby, Tamara, Mozn, Salla, Foodics | 5 |

Each job has a full structured `dimension_requirements` vector and `required_skills` list.

### 11.4 Mock interview scenarios
3 seeded scenarios for Tech cluster (behavioral, situational, technical-soft).

---

## 12. File and Folder Structure

```
careerforge/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                            (landing)
│   ├── signup/page.tsx
│   ├── verify/page.tsx
│   ├── onboarding/page.tsx
│   ├── dashboard/page.tsx
│   ├── profile/page.tsx
│   ├── skills/page.tsx
│   ├── roadmap/page.tsx
│   ├── simulator/page.tsx
│   ├── insights/page.tsx
│   ├── mock-interview/page.tsx
│   ├── jobs/page.tsx
│   ├── jobs/[id]/page.tsx
│   ├── applications/page.tsx
│   ├── corporate/page.tsx
│   ├── corporate/signup/page.tsx
│   ├── corporate/verify/page.tsx
│   ├── corporate/dashboard/page.tsx
│   ├── corporate/post-job/page.tsx
│   ├── corporate/jobs/[id]/applicants/page.tsx
│   ├── corporate/jobs/[id]/applicants/[appId]/page.tsx
│   └── api/                                (route handlers; see Section 7)
├── components/
│   ├── Nav.tsx
│   ├── LanguageToggle.tsx
│   ├── ReadinessRing.tsx
│   ├── ScoreBar.tsx
│   ├── RoadmapTimeline.tsx
│   ├── RoadmapKanban.tsx
│   ├── JobCard.tsx
│   ├── VerifiedBadge.tsx
│   ├── SimulatorSkillToggle.tsx
│   ├── OnboardingStep.tsx
│   ├── ProgressBar.tsx
│   ├── ChipSelect.tsx
│   ├── AutocompleteInput.tsx
│   ├── StructuredRejectionModal.tsx
│   └── ...
├── lib/
│   ├── db.ts                               (postgres connection pool)
│   ├── session.ts                          (iron-session config)
│   ├── auth.ts                             (getSession, requireSession helpers)
│   ├── readiness.ts                        (Section 8.1)
│   ├── role-match.ts                       (Section 8.2)
│   ├── points.ts                           (Section 8.3)
│   ├── job-vector.ts                       (Section 8.4)
│   ├── simulator.ts                        (Section 8.5)
│   ├── cluster.ts                          (Section 8.6)
│   ├── claude.ts                           (Anthropic SDK wrapper)
│   ├── email.ts                            (Resend wrapper — interview / offer transactional emails only)
│   └── prompts/
│       ├── roadmap.ts                      (Section 9.1 — Claude #2)
│       ├── transcript.ts                   (Section 9.2 — Claude #1)
│       ├── mock-interview.ts               (Section 9.3 — Claude #4)
│       ├── insight-explanation.ts          (Section 9.4 — Claude #5 used on /insights)
│       ├── skill-description.ts            (Section 9.5 — Claude #3 used on /skills)
│       └── job-path.ts                     (Section 9.6 — Claude #6 used on /jobs/[id])
├── i18n/
│   ├── en.json
│   ├── ar.json
│   └── LanguageProvider.tsx
├── styles/
│   └── globals.css                         (port of prototype's style.css)
├── data/
│   ├── seed.sql                            (or scripts/seed.ts)
│   ├── regions-cities.json
│   ├── universities.json
│   ├── boost-matrix.json
│   ├── skill-ontology.json
│   ├── role-catalog.json
│   └── mock-interview-scenarios.json
├── db/
│   └── migrations/
│       ├── 0001_initial.sql                (Section 3 schema)
│       └── ...
├── public/                                 (static assets, logos)
├── .env.local                              (gitignored)
├── .env.example
├── README.md
├── LICENSE                                 (MIT)
├── package.json
├── tsconfig.json
├── next.config.js
└── ...
```

---

## 13. Out of Scope (Explicit Cuts)

These are NOT being built. The README states each cut honestly.

- ❌ Mobile responsive layout
- ❌ Real Credly API integration
- ❌ **Certificate AI inspection** (deferred — `student_experiences.verification_status` is manual / admin in v1)
- ❌ Streak / decay / Pause Mode mechanics
- ❌ Multi-user HR seats per corporate
- ❌ Corporate ↔ student messaging beyond the interview/offer email and contact info on offer
- ❌ Voice mock interview
- ❌ SMS or push notifications (Resend email only)
- ❌ Multi-target role merging (one target role per student)
- ❌ 90%+ flip mode (interview prep mode, stretch roles)
- ❌ Resource URL validation (Claude's suggested URLs accepted as-is; thumbs-down feedback not built)
- ❌ Salary projection charts
- ❌ Critical prerequisite chains as fixed graphs (LLM-suggested prereqs only)
- ❌ Calendar-based Tier 1 logic (no separate events table; Tier 1 driven by `jobs.hiring_outcome_flag` only)
- ❌ Multiple AI providers
- ❌ **Kanban view of roadmap** (timeline view only — saves UI build time)
- ❌ Medicine and Engineering cluster content (data model supports them; only Tech cluster has seeded jobs and roadmap content)
- ❌ Real Wathq API integration for CR verification (CR captured + format-validated only; seeded accounts pre-marked verified)
- ❌ Real-time updates via WebSockets (page refresh required to see new state)
- ❌ Resume / CV upload and parsing (separate from transcript)
- ❌ Salary negotiation tools, mentorship matching, premium features
- ❌ Admin / superuser panel
- ❌ Email templates beyond OTP and basic notifications (interview + offer only)
- ❌ "Last cohort hired N of M" stats on Tier-1 nodes (no historical data)
- ❌ Withdraw application flow (state exists in enum but no UI button)
- ✅ **Live market vector recalibration** (NOW IN SCOPE — see Section 5.5 dynamic skill bars, Section 8.5 dynamic boost matrix, and corporate post-job triggering Tier-1 node additions to matching students)

---

## 14. The Five Demo Moments

All anchored to specific routes for the video recording. Each takes 20–45 seconds in the final 5-minute video.

### Moment 1: Onboarding completes → roadmap generates
- Path: `/onboarding` step 12 → "Generate my roadmap" button → loading screen with real Claude streaming animation → redirect to `/roadmap`.
- Voiceover: *"Generated live by Claude. Rules computed the gaps; AI suggested resources and wrote the readable layer."*
- Duration: 45 seconds (speed up the onboarding clicks in editing).

### Moment 2: Cert / transcript upload → readiness jump
- Path: `/profile` → upload transcript image → Claude Vision extracts → save → return to `/dashboard` → readiness ring animates from 65% to 71%.
- Voiceover: *"Real verification. Real Claude Vision API call. Score updates from real data."*
- Duration: 30 seconds.

### Moment 3: Corporate-side trigger
- Path: log out → log in as corporate → `/corporate/post-job` → fill 10 fields, mark hiring outcome → submit → log out → log in as student → `/roadmap` → new Tier-1 node visible at the top.
- Voiceover: *"The market vector is alive. Every corporate posting reshapes student roadmaps."*
- Duration: 60 seconds (the longest moment; pre-set session switching in editing).

### Moment 4: Mock interview → roadmap adapts
- Path: `/mock-interview` → type 2-line response → submit → 5 scores appear → click "Add to roadmap" on weakest area → confirm → return to `/roadmap` → new practice node at top.
- Voiceover: *"AI feedback closes the loop. Every interaction tightens the plan."*
- Duration: 30 seconds.

### Moment 5: Tier 1 click-through
### Moment 5: Tier 1 click-through → dual readiness + AI path on the job page
- Path: `/roadmap` → click a Tier-1 node → expandable showing job summary + "Open job" → land on `/jobs/[id]` → dual readiness rings render side by side (e.g., General 70%, Job 82%) → scroll to the "Close the Gap" card → 3–5 AI-generated steps appear with expected lift per step → click "Add to my Roadmap" on one step → toast confirms → Apply CTA.
- Voiceover: *"Two readiness numbers, not one. General tells the student where they stand overall. Job Readiness tells them where they stand against this specific posting. And Claude generates a real path to close the gap — not generic advice, specific steps tied to this job's actual requirements."*
- Duration: 35 seconds (slightly longer than the original 20s — this is the headline AI moment for the job side).

---

## 15. README and Submission Requirements

The README must be accurate and complete. AI code review will read it first.

### Required sections
1. **Title and one-line pitch**
2. **Live demo URL** (Vercel) + **demo video URL** (YouTube unlisted or Google Drive)
3. **Features built** — honest checklist with ✅ / ❌ from Section 13's cuts
4. **Tech stack** — Section 2 table
5. **Architecture overview** — short version of this doc, link to full
6. **Setup instructions** — clone, npm install, .env, npm run dev, applied migrations
7. **Environment variables** — list from `.env.example`
8. **Demo accounts** — pre-seeded student email + corporate email + how to receive OTP for them (use the seeded account's email)
9. **Database schema** — link to migration files
10. **AI integrations** — list all 6 Claude calls and where they live
11. **Vision 2030 alignment** paragraph
12. **License** — MIT
13. **Contributing / Acknowledgments** — optional

### Files in repo
- `README.md`
- `LICENSE` (MIT)
- `.env.example`
- `.gitignore` (includes `.env.local`, `node_modules`, `.next`)
- All source code in `app/`, `components/`, `lib/`, `i18n/`, `data/`, `db/`
- `package.json` with all dependencies
- `next.config.js`

### Pre-submission checklist
- [ ] `npm run build` succeeds with zero errors
- [ ] No API key or secret in any commit (run `git log -p | grep -i "sk-ant\|re_\|postgres://"` to verify)
- [ ] All 6 Claude calls work end-to-end on the deployed URL
- [ ] OTP email arrives in real inbox (test with a personal email)
- [ ] Database migrations applied successfully on Neon
- [ ] Demo accounts work on deployed URL
- [ ] Video uploaded, link works in incognito
- [ ] GitHub repo is public

---

## 16. Risk Register

Top risks and the response plan.

| Risk | Likelihood | Impact | Response |
|---|---|---|---|
| Claude API rate-limit or outage during video recording | Medium | High | Pre-warm with a few test runs. If outage, pause recording, resume. Worst case: have a 30-second backup video of the AI moment recorded earlier. |
| Neon connection issues | Low | High | Use Neon's connection pooling. Have local Postgres as fallback for development. |
| Vercel build fails on deploy | Medium | High | Test `npm run build` locally before every push. Read build logs carefully. |
| Resend deliverability (OTP not arriving) | Medium | Medium | Test with personal email early. Spam folder check. Note in README that OTP can take up to 60 seconds. |
| Antigravity agent produces buggy code | High | Medium | Use Plan mode for critical paths. Verify each phase before moving on. Budget 2× the estimated hours. |
| Roadmap Claude call returns malformed JSON | Medium | Medium | Zod validation + one retry. If still fails, surface error to user with a "Try again" button. No fake fallback content. |
| Vision parsing accuracy below 80% on test transcripts | Medium | Low | Verification step (editable table) catches all errors. Worst case: student manually enters courses. |
| Time overrun on Day 1 | High | High | Cut sequence (in order if needed): Insights AI explanation → Mock interview improvement areas auto-add → Kanban view of roadmap → Insights page entirely. |
| GitHub push contains secrets | Low | Critical | Triple-check `.gitignore` before first push. Run secret grep before each push. |

---

## End of Build Specification

**This document is the contract.** Antigravity agent prompts in subsequent messages will reference specific sections of this document. If a feature appears in a prompt but not in this document, push back and ask for confirmation before building it. If a feature appears in this document but not in any prompt, it gets added before the build is considered complete.

Last revised: pre-build, Day 1 hour 0.
